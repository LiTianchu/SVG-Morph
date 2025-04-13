import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { interpolate } from 'flubber';
import PathUtils from './PathUtils';
import MiscUtils from './MiscUtils';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import PolygonUtils from './PolygonUtils';
import JSZip from 'jszip';

function SVGMorph({ svgs, morphSetting, exportSetting, onLoadingStateChange }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const pathsRef = useRef([]); // stores path elements and their interpolators
  const [viewBoxSize, setViewBoxSize] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [isMorphing, setIsMorphing] = useState(false);
  const [currentMorphSetting, setCurrentMorphSetting] = useState({
    duration: 1000,
    quality: 10,
    easing: 'linear',
    oneToMany: 'duplicate',
    matching: 'default'
  });
  const [currentExportSetting, setCurrentExportSetting] = useState({
    framerate: 24,
    resolution: 1024,
    fileFormat: "MP4",
    filename: "morphing"
  });

  const [currentSvgs, setCurrentSvgs] = useState([]);
  const ffmpegRef = useRef(null);

  const originalCanvasWidth = 512;
  const originalCanvasHeight = 512;


  const localWasmPath = '/ffmpeg-core.wasm';
  const localCorePath = '/ffmpeg-core.js';

  useEffect(() => {
    const loadFFmpeg = async () => {
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();

        await ffmpegRef.current.load({
          log: true,
          coreURL: localCorePath,
          wasmURL: localWasmPath,
          memoryInitialSize: 512,
          memoryMaximumSize: 32768,
        });
        console.log("ffmpeg loaded");
      }
    };
    loadFFmpeg();
  }, []); // run once on mount to initialize ffmpeg

  useEffect(() => {
    // if the current morph setting is the same as the previous one, do not reinitialize
    if (morphSetting.oneToMany === currentMorphSetting.oneToMany &&
      morphSetting.quality === currentMorphSetting.quality &&
      morphSetting.matching === currentMorphSetting.matching &&
      currentSvgs === svgs) {

      setCurrentSvgs(svgs);
      setCurrentMorphSetting(morphSetting);
      return;
    } else {
      console.log(morphSetting.oneToMany === currentMorphSetting.oneToMany);
      console.log(morphSetting.quality === currentMorphSetting.quality);
      console.log(morphSetting.matching === currentMorphSetting.matching);
      console.log(currentSvgs === svgs);
      console.log("reinitializing morph setting");
      console.log("SVGs length: " + svgs.length);      
      console.log(currentSvgs);
      console.log(svgs);
      console.log("Morph settings:");
      console.log(currentMorphSetting);
      console.log(morphSetting);
      setCurrentSvgs(svgs);
      setCurrentMorphSetting(morphSetting);
    }


    d3.select(svgRef.current).selectAll('*').remove();
    pathsRef.current = []; // clear previous paths
    setInitialized(false);
    setIsMorphing(false);
    onLoadingStateChange(true, false, { text: "Please upload at least 2 SVGs to start morphing." });

    let timeElapsed = new Date().getTime();

    if (!svgs || svgs.length < 2) {
      return;
    }

    const computeViewBox = () => {
      onLoadingStateChange(false, false, { text: "Computing viewbox size..." });
      console.log("computing viewbox size timestamp: " + (new Date().getTime() - timeElapsed));

      // compute view box size
      let sizeX = 0;
      let sizeY = 0;
      svgs.forEach(svgString => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox != null) {

          const svgViewBoxSize = viewBox.split(' ').slice(2);
          //console.log("viewbox size: " + svgViewBoxSize);
          if (parseFloat(svgViewBoxSize[0]) > sizeX) {
            sizeX = svgViewBoxSize[0];
          }
          if (parseFloat(svgViewBoxSize[1]) > sizeY) {
            sizeY = svgViewBoxSize[1];
          }
        } else {
          const { width, height } = PathUtils.getWidthHeight(svgElement);
          if (width > sizeX) {
            sizeX = width;
          }
          if (height > sizeY) {
            sizeY = height;
          }
        }

      });
      setViewBoxSize({ x: sizeX, y: sizeY });
      return { x: sizeX, y: sizeY };
    }


    const extractPath = () => {
      onLoadingStateChange(false, false, { text: "Extracting paths..." });
      console.log("extracting paths timestamp: " + (new Date().getTime() - timeElapsed));

      // extract path to get the list of paths of each svg
      const svgPathLists = svgs.map(PathUtils.extractPaths);
      return svgPathLists
    }

    const standardizePathNum = (svgPathLists, vbSize) => {
      // make all svgs have the same number of paths
      onLoadingStateChange(false, false, { text: "Standardizing number of paths..." });
      console.log("standardizing number of paths timestamp: " + (new Date().getTime() - timeElapsed));
      const maxPaths = Math.max(...svgPathLists.map(pathList => pathList.length));

      for (let i = 0; i < svgPathLists.length; i++) {
        const initialPathNum = svgPathLists[i].length;
        for (let j = initialPathNum; j < maxPaths; j++) {
          const dupIndex = j % initialPathNum;
          if (morphSetting.oneToMany === 'duplicate') {
            //const dupIndex = 0;
            svgPathLists[i].splice(dupIndex, 0, svgPathLists[i][dupIndex]); // duplicate the path

          } else if (morphSetting.oneToMany === 'appear') {

            svgPathLists[i].push({ // add an empty path
              mainPath: `M${vbSize.x / 2},${vbSize.y / 2} Z`,
              maskPaths: [],
              fillColor: "black",
              strokeData: { strokeColor: "black", strokeWidth: 0, strokeOpacity: 0 }
            });
          }
        }
      }

      if (svgPathLists.some(pathList => pathList.length === 0)) {
        console.error('No paths found in svg');
        return;
      }
      return svgPathLists;
    }

    const getInterpolatorTillEnd = (svgPathLists, pathIndex, maxSegmentLength, used) => {
      onLoadingStateChange(false, false, { text: "Generating interpolators for path at index " + pathIndex });
      console.log("generating interpolators for path at index " + pathIndex + " timestamp: " + (new Date().getTime() - timeElapsed));
      let selectedPathIndex = pathIndex;
      const initialPathIndex = pathIndex; // record initial path for looping back to original path

      const interpolatorsToEnd = svgPathLists.map((pathList, j) => {
        // pathList is the list of paths of the j-th svg
        const path = pathList[selectedPathIndex]; // current path

        used[j][selectedPathIndex] = true; // mark the path as used
        console.log(used);

        if (j === svgPathLists.length - 1) { // if this is the last svg
          // loop back to the initial path
          selectedPathIndex = initialPathIndex; // set the next pair path index
        } else if (morphSetting.matching === 'random') {
          // choose a random path from the next svg
          const pathNum = pathList.length;
          do {
            selectedPathIndex = Math.floor(Math.random() * pathNum);
          } while (used[j + 1][selectedPathIndex]); // if this path is marked as used, choose another one
        } else if (morphSetting.matching != 'default') {
          // choose the next pair path based on the matching condition
          const nextSvgPathList = svgPathLists[(j + 1) % svgPathLists.length];

          let smallestAbsAreaDiff = Number.MAX_VALUE;
          let largestAbsAreaDiff = 0;

          let smallestDistance = Number.MAX_VALUE;
          let largestDistance = 0;

          let nextPairPathIndex = -1;

          nextSvgPathList.forEach((nextSvgPath, nextPIndex) => {
            if (used[(j + 1)][nextPIndex]) { return; }// if this path is marked as used, skip it
            if (morphSetting.matching.includes('area')) {
              // compute the area difference between the two paths
              const pathArea = PolygonUtils.computePolygonArea(path.mainPathPoints);
              const nextPathArea = PolygonUtils.computePolygonArea(nextSvgPath.mainPathPoints);
              const absAreaDiff = Math.abs(pathArea - nextPathArea);
              if (morphSetting.matching === 'closest-area') {
                if (absAreaDiff < smallestAbsAreaDiff) {
                  smallestAbsAreaDiff = absAreaDiff;
                  nextPairPathIndex = nextPIndex;
                }
              } else if (morphSetting.matching === 'furthest-area') {
                if (absAreaDiff > largestAbsAreaDiff) {
                  largestAbsAreaDiff = absAreaDiff;
                  nextPairPathIndex = nextPIndex;
                }
              }
            } else if (morphSetting.matching.includes('distance')) {
              // compute the distance between the two paths
              const pathCentroid = PolygonUtils.getCentroid(path.mainPathPoints);
              const nextPathCentroid = PolygonUtils.getCentroid(nextSvgPath.mainPathPoints);
              const dist = PolygonUtils.getEuclideanDistance(pathCentroid, nextPathCentroid);

              if (morphSetting.matching === 'closest-distance') {
                if (dist < smallestDistance) {
                  smallestDistance = dist;
                  nextPairPathIndex = nextPIndex;
                }
              } else if (morphSetting.matching === 'furthest-distance') {
                if (dist > largestDistance) {
                  largestDistance = dist;
                  nextPairPathIndex = nextPIndex;
                }
              }
            }
          });

          if (nextPairPathIndex === -1) {
            console.error("No suitable pair path found for svg " + j + " path at index " + pathIndex);
            return;
          }

          selectedPathIndex = nextPairPathIndex; // set the next pair path index
        }


        const nextPairPath = svgPathLists[(j + 1) % svgPathLists.length][selectedPathIndex]; // next pair path
        let fromPathList = [path.mainPath];
        let toPathList = [nextPairPath.mainPath];
        const fromStroke = path.strokeData;
        const toStroke = nextPairPath.strokeData;
        const fromFillColor = path.fillColor;
        const toFillColor = nextPairPath.fillColor;

        // fill in the missing mask paths for both from and to paths
        const maxMaskPathsNum = Math.max(...svgPathLists.flat().map(path => path.maskPaths.length));
        for (let k = 0; k < maxMaskPathsNum; k++) {
          if (path.maskPaths[k] == null) {
            // create a empty mask path
            const center = PathUtils.computePathCenter(path.mainPath);
            // add an empty path at the certer
            fromPathList.push(`M${center.x},${center.y} Z`);

          } else {
            fromPathList.push(path.maskPaths[k]);
          }

          if (nextPairPath.maskPaths[k] == null) {
            // create a empty mask path
            const center = PathUtils.computePathCenter(nextPairPath.mainPath);
            // add an empty path at the certer
            toPathList.push(`M${center.x},${center.y} Z`);
          }
          else {
            toPathList.push(nextPairPath.maskPaths[k]);
          }

        }

        let interpolators = { mainPathInterpolator: null, maskPathInterpolators: [], fillColorInterpolator: null, stokeColorInterpolator: null, strokeWidthInterpolator: null, strokeOpacityInterpolator: null };

        // generate interpolators for main path
        const mainInterpolator = interpolate(fromPathList[0], toPathList[0], { maxSegmentLength: maxSegmentLength });
        interpolators.mainPathInterpolator = mainInterpolator;

        // generate interpolators for mask paths
        for (let k = 1; k < fromPathList.length; k++) {
          const maskPathInterpolator = interpolate(fromPathList[k], toPathList[k], { maxSegmentLength: maxSegmentLength });
          interpolators.maskPathInterpolators.push(maskPathInterpolator);
        }

        interpolators.fillColorInterpolator = d3.interpolateRgb(fromFillColor, toFillColor);
        interpolators.strokeOpacityInterpolator = d3.interpolate(fromStroke.strokeOpacity, toStroke.strokeOpacity);
        interpolators.stokeColorInterpolator = d3.interpolateRgb(fromStroke.strokeColor, toStroke.strokeColor);
        interpolators.strokeWidthInterpolator = d3.interpolate(fromStroke.strokeWidth, toStroke.strokeWidth);

        return interpolators;
      });
      return interpolatorsToEnd;
    }

    const setUpInterpolation = () => {
      onLoadingStateChange(false, false, { text: "Starting to set up interpolation..." });
      console.log("setting up interpolation timestamp: " + (new Date().getTime() - timeElapsed));

      const newViewBoxSize = computeViewBox();
      const maxSegmentLength = newViewBoxSize.x / (parseInt(morphSetting.quality) * 10);
      let svgPathLists = extractPath(svgs);
      svgPathLists = standardizePathNum(svgPathLists, newViewBoxSize);

      const maxMaskPathsNum = Math.max(...svgPathLists.flat().map(path => path.maskPaths.length));
      console.log(svgPathLists);
      const used = Array.from({ length: svgs.length }, () => Array.from({ length: svgPathLists[0].length }, () => false)); // table to mark used paths used[j][i] = true if the i-th path of the j-th svg is used
      // iterate over each path of the first svg to generate the set of interpolators
      svgPathLists[0].forEach((mainMaskPair, i) => {
        const firstMainPath = mainMaskPair.mainPath;
        const firstFillColor = mainMaskPair.fillColor;
        const firstStroke = mainMaskPair.strokeData;

        let firstMainPathMasks = [];
        for (let k = 0; k < maxMaskPathsNum; k++) {
          if (mainMaskPair.maskPaths[k] == null) {
            const center = PathUtils.computePathCenter(firstMainPath);
            firstMainPathMasks.push(`M${center.x},${center.y} Z`);
          } else {
            firstMainPathMasks.push(mainMaskPair.maskPaths[k]);
          }
        }
        const interpolatorsToEnd = getInterpolatorTillEnd(svgPathLists, i, maxSegmentLength, used);

        // generate initial elements for morphing
        const maskTagElement = d3.select(svgRef.current).append('mask')
          .attr('id', `mask-${i}`)

        maskTagElement.append('rect')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('fill', 'white')

        firstMainPathMasks.forEach((maskPath, k) => {
          maskTagElement.append('path')
            .attr('d', maskPath)
            .attr('fill', 'black')
        });

        const pathElement = d3.select(svgRef.current).append('path')
          .attr('d', firstMainPath)
          .attr('fill', firstFillColor)
          .attr('id', `path-${i}`)
          .attr('stroke', firstStroke.strokeColor)
          .attr('stroke-width', firstStroke.strokeWidth)
          .attr('stroke-opacity', firstStroke.strokeOpacity)
          .attr('fill-rule', 'nonzero')
          .attr('mask', `url(#mask-${i})`); // link to masks

        // push the starting path element and the series of interpolators to the end
        pathsRef.current.push({ pathElement, maskTagElement, interpolatorsToEnd });
      });

      onLoadingStateChange(false, false, { text: "Finished setting up interpolation, triggering animation..." });
      console.log("finished setting up interpolation timestamp: " + (new Date().getTime() - timeElapsed));
      console.log("intiialized before " + initialized);
      setInitialized(true);
      console.log("intiialized after " + initialized);
    }

    setUpInterpolation();

    return () => {
      d3.select(svgRef.current).selectAll('*').interrupt();
    };
  }, [svgs, morphSetting]);


  // animation use effect
  useEffect(() => {
    console.log("trying to trigger animation, initialized " + initialized);

    if (!initialized) {
      setIsMorphing(false);
      onLoadingStateChange(false, false, { text: "" });
      return;
    } else {
      setIsMorphing(true);
      onLoadingStateChange(false, true, { text: "" });
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').interrupt();

    const morphDuration = morphSetting.duration;
    const easing = morphSetting.easing;
    const d3Easing = MiscUtils.getD3Easing(easing);

    function animateMainPath(pathElement, interpolatorsToEnd, interpolatorIdx) {
      d3.select(pathElement.node())
        .transition()
        .ease(d3Easing)
        .duration(morphDuration)
        .attrTween('d', () => interpolatorsToEnd[interpolatorIdx].mainPathInterpolator) // shape
        .attrTween('fill', () => interpolatorsToEnd[interpolatorIdx].fillColorInterpolator) // color
        .attrTween('stroke', () => interpolatorsToEnd[interpolatorIdx].stokeColorInterpolator) // stroke color
        .attrTween('stroke-width', () => interpolatorsToEnd[interpolatorIdx].strokeWidthInterpolator) // stroke width
        .attrTween('stroke-opacity', () => interpolatorsToEnd[interpolatorIdx].strokeOpacityInterpolator) // stroke opacity
        .on('end', () => animateMainPath(pathElement, interpolatorsToEnd, (interpolatorIdx + 1) % interpolatorsToEnd.length));
    }

    function animateMaskPath(maskTagElement, interpolatorsToEnd, interpolatorIdx, pathIdx) {
      d3.select(maskTagElement.selectAll('path').nodes()[pathIdx])
        .transition()
        .ease(d3Easing)
        .duration(morphDuration)
        .attrTween('d', () => interpolatorsToEnd[interpolatorIdx].maskPathInterpolators[pathIdx])
        .on('end', () => animateMaskPath(maskTagElement, interpolatorsToEnd, (interpolatorIdx + 1) % interpolatorsToEnd.length, pathIdx));
    }

    pathsRef.current.forEach((pathAndInterpolators, i) => {
      const pathElement = pathAndInterpolators.pathElement;
      const maskTagElement = pathAndInterpolators.maskTagElement;
      const interpolatorsToEnd = pathAndInterpolators.interpolatorsToEnd;
      animateMainPath(pathElement, interpolatorsToEnd, 0);

      maskTagElement.selectAll('path').nodes().forEach((_, k) => {
        animateMaskPath(maskTagElement, interpolatorsToEnd, 0, k);
      })
    });

  }, [initialized, morphSetting, svgs]);

  useEffect(() => {
    setCurrentExportSetting(exportSetting);
  }, [exportSetting]);

  const getFrameQueue = (frameCount) => {
    const svg = d3.select(svgRef.current);
    const numOfMorphs = pathsRef.current[0].interpolatorsToEnd.length;
    const numOfMaskPathsPerNormalPath = pathsRef.current[0].interpolatorsToEnd[0].maskPathInterpolators.length;
    console.log("num of morphs: " + numOfMorphs);
    // get the easing function from the morph setting
    const d3Easing = MiscUtils.getD3Easing(morphSetting.easing);
    const downloadQueue = [];
    for (let m = 0; m < numOfMorphs; m++) {
      const numFrames = frameCount; // frames per second
      const frames = Array.from({ length: numFrames }, (_, i) => i / (numFrames - 1));
      frames.forEach((t, frameIndex) => {
        // get the eased time
        let tEased = d3Easing(t);

        // update main paths
        svg.selectAll(':scope > path').each(function (_, i) {
          const path = d3.select(this);
          const interpolators = pathsRef.current[i].interpolatorsToEnd;
          path.attr('d', interpolators[m].mainPathInterpolator(tEased));
          path.attr('fill', interpolators[m].fillColorInterpolator(tEased));
          path.attr('stroke', interpolators[m].stokeColorInterpolator(tEased));
          path.attr('stroke-width', interpolators[m].strokeWidthInterpolator(tEased));
          path.attr('stroke-opacity', interpolators[m].strokeOpacityInterpolator(tEased));

        });

        // update all mask paths
        svg.selectAll('mask path').each(function (_, i) {
          const maskPath = d3.select(this);
          const pathIndex = Math.floor(i / numOfMaskPathsPerNormalPath);
          const maskPathIndex = i % numOfMaskPathsPerNormalPath;
          const interpolators = pathsRef.current[pathIndex].interpolatorsToEnd;
          maskPath.attr('d', interpolators[m].maskPathInterpolators[maskPathIndex](tEased));
        });

        // serialize the updated SVG to an image source
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
        downloadQueue.push({ img, m, frameIndex });
      });
    }
    return downloadQueue;
  }

  const rescaleCanvas = (scaleFactor) => {
    const cWidth = originalCanvasWidth * scaleFactor;
    const cHeight = originalCanvasHeight * scaleFactor;

    // resize canvas based on scale factor
    canvasRef.current.width = cWidth;
    canvasRef.current.height = cHeight;
  }
  
  const handleFrameExport = async () => {
    if (!isMorphing) { return; }
    const context = canvasRef.current.getContext('2d');
    const scaleFactor = currentExportSetting.resolution / originalCanvasWidth;
    rescaleCanvas(scaleFactor);

    const zip = new JSZip();

    const downloadQueue = getFrameQueue(currentExportSetting.framerate);
    let processedCount = 0;

    // process all frames and add to zip
    for (const { img, m, frameIndex } of downloadQueue) {
      // ensure image is loaded before drawing
      if (!img.complete) {
        await new Promise((resolve) => { img.onload = resolve; });
      }

      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      context.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);

      const pngBlob = await new Promise(resolve => {
        canvasRef.current.toBlob(resolve, 'image/png');
      });

      const fileName = `image-morph${m}-frame${frameIndex}.png`;
      zip.file(fileName, pngBlob);
      console.log(`Added ${fileName} to zip`);

      processedCount++;
    }
    console.log('zipping frames...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);

    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = `${currentExportSetting.filename}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('downloaded zip file');
    // clean up
    URL.revokeObjectURL(zipUrl);
  }

  //  convert data URL to Uint8Array for ffmpeg 
  const dataURLtoUint8Array = (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  //  button handler to export video using ffmpeg with batching
  const handleVideoExport = async () => {
    if (!isMorphing) { return; }

    // get the settings for export
    const scaleFactor = currentExportSetting.resolution / originalCanvasWidth;
    rescaleCanvas(scaleFactor); // scale canvas
    const fps = currentExportSetting.framerate;
    const separated = currentExportSetting.fileFormat === 'Separated MP4s';
    const numOfMorphs = pathsRef.current[0].interpolatorsToEnd.length;

    // calculate frames
    const totalFrames = Math.ceil((morphSetting.duration / 1000) * fps);
    console.log(`Resolution: ${canvasRef.current.width}x${canvasRef.current.height}`);
    console.log(`FPS: ${fps}, Frames per morph: ${totalFrames}`);
    console.log(`Total frames: ${totalFrames * numOfMorphs}`);

    // generate the sequence of frames
    const frameQueue = getFrameQueue(totalFrames);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // determine batch size based on resolution, smaller batches for higher resolutions
    // decreases batch size as resolution increases
    const BATCH_SIZE = Math.max(10, Math.min(30, Math.floor(2000000 / (canvas.width * canvas.height))));
    console.log(`Using batch size of ${BATCH_SIZE} frames per batch`);

    // array to store temporary video segment filenames
    const tempSegmentFiles = [];

    if (separated) {
      for (let m = 0; m < numOfMorphs; m++) {
        const segmentFiles = [];

        // calculate frames for this morph
        const morphFrames = frameQueue.filter(item => item.m === m);

        // batching
        for (let batchStart = 0; batchStart < morphFrames.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, morphFrames.length);
          const currentBatch = morphFrames.slice(batchStart, batchEnd);
          const batchIdx = Math.floor(batchStart / BATCH_SIZE);

          // write batch frames to ffmpeg filesystem
          await processBatchFrames(currentBatch, context, m);

          const segmentFile = `temp_morph${m}_segment${batchIdx}.mp4`;
          console.log(`creating video segment for morph ${m}, batch ${batchIdx}`);
          await ffmpegRef.current.exec([
            '-framerate', `${fps}`,
            '-start_number', `${currentBatch[0].frameIndex}`,
            '-i', `morph${m}_frame%09d.png`,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-f', 'mp4',
            segmentFile
          ]);

          segmentFiles.push(segmentFile);
          console.log(`created video segment: ${segmentFile}`);

          // clean up the frame files to free memory
          for (const { frameIndex } of currentBatch) {
            const fileName = `morph${m}_frame${String(frameIndex).padStart(9, "0")}.png`;
            try {
              await ffmpegRef.current.deleteFile(fileName);
              console.log(`deleted temporary frame: ${fileName}`);
            } catch (e) {
              console.error("Failed to delete frame:", fileName, e);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const concatContent = segmentFiles.map(file => `file '${file}'`).join('\n');
        console.log(concatContent);
        const concatFileName = `concat_morph${m}.txt`;
        await ffmpegRef.current.writeFile(concatFileName, concatContent);

        // concatenate temp segments to final output for this morph
        const outputFile = `${currentExportSetting.filename}_${m}.mp4`;
        console.log(`creating concat video file for morph ${m}`);
        await ffmpegRef.current.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', concatFileName,
          '-c', 'copy',
          '-movflags', '+faststart',
          outputFile
        ]);

        const videoData = await ffmpegRef.current.readFile(outputFile);
        const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(videoBlob);

        const link = document.createElement('a');
      link.href = url;
        link.download = outputFile;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log(`downloaded concat video file for morph ${m}`);


        // clean up this morph's temp files
        for (const file of segmentFiles) {
          console.log('trying to delete temporary segment:', file);
          await ffmpegRef.current.deleteFile(file);
          console.log(`deleted temporary segment: ${file}`);
        }
        await ffmpegRef.current.deleteFile(concatFileName);
        console.log(`deleted concat file: ${concatFileName}`);
        await ffmpegRef.current.deleteFile(outputFile);
        console.log(`deleted output file: ${outputFile}`);
      }
    } else {
      for (let m = 0; m < numOfMorphs; m++) {
        const morphFrames = frameQueue.filter(item => item.m === m);

        for (let batchStart = 0; batchStart < morphFrames.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, morphFrames.length);
          const currentBatch = morphFrames.slice(batchStart, batchEnd);
          const batchIdx = Math.floor(batchStart / BATCH_SIZE);
          const segmentIdx = m * Math.ceil(morphFrames.length / BATCH_SIZE) + batchIdx;

          // process each frame in the batch
          await processBatchFrames(currentBatch, context, m, totalFrames);

          // create video clip segment for this batch
          const segmentFile = `temp_segment${segmentIdx}.mp4`;

          console.log(`creating video segment for morph ${m}, batch ${batchIdx}`);
          await ffmpegRef.current.exec([
            '-framerate', `${fps}`,
            '-start_number', `${m * totalFrames + batchStart}`,
            '-i', `frame%09d.png`,
            '-frames:v', `${currentBatch.length}`,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-f', 'mp4',
            segmentFile
          ]);


          tempSegmentFiles.push(segmentFile);
          console.log(`created video segment: ${segmentFile}`);

          // clean up frame files to free memory
          for (const { frameIndex } of currentBatch) {
            const fileName = `frame${String(frameIndex + totalFrames * m).padStart(9, "0")}.png`;
            try {
              await ffmpegRef.current.deleteFile(fileName);
              console.log(`deleted temporary frame: ${fileName}`);
            } catch (e) {
              console.error("Failed to delete frame:", fileName);
            }
          }

          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Create concat file
      const concatContent = tempSegmentFiles.map(file => `file '${file}'`).join('\n');
      await ffmpegRef.current.writeFile('concat.txt', concatContent);
      console.log('creating concat video file');
      // concatenate temp video clips to final output
      const outputFile = `${currentExportSetting.filename}.mp4`;
      await ffmpegRef.current.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        '-movflags', '+faststart',
        outputFile
      ]);

      // download the final output
      const videoData = await ffmpegRef.current.readFile(outputFile);
      const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = outputFile;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('downloaded video file');
    }


    // delete all temporary files
    try {
      const files = await ffmpegRef.current.listDir('/');
      for (const file of files) {
        if (file.name && (file.name.endsWith('.png') || file.name.endsWith('.mp4') || file.name.endsWith('.txt'))) {
          await ffmpegRef.current.deleteFile(file.name);
          console.log(`deleted temporary file: ${file.name}`);
        }
      }
    } catch (e) {
      console.error("error during cleanup:", e);
    }
  };

  // helper function to process batch frames
  const processBatchFrames = async (batch, context, morphIdx, totalFrames = null) => {
    console.log(batch);
    for (const { img, frameIndex } of batch) {
      // ensure image is loaded
      if (!img.complete) {
        await new Promise(resolve => { img.onload = resolve; });
      }

      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      context.drawImage(img, 0, 0, context.canvas.width, context.canvas.height);

      const dataUrl = context.canvas.toDataURL('image/png');
      const data = dataURLtoUint8Array(dataUrl);

      let fileName;
      if (totalFrames === null) {
        fileName = `morph${morphIdx}_frame${String(frameIndex).padStart(9, "0")}.png`;
      } else {
        fileName = `frame${String(frameIndex + totalFrames * morphIdx).padStart(9, "0")}.png`;
      }

      await ffmpegRef.current.writeFile(fileName, data);
      console.log(`wrote ${fileName} to ffmpeg VFS`);
      URL.revokeObjectURL(dataUrl);
    }
  }

  return (
    <div style={{ width: "100%", height: "100%", margin: "auto" }}>
      <div style={{ display: isMorphing ? 'flex' : 'none', width: "100%", height: "100%" }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ color: 'black', fontSize: '20px', width: '100%', textAlign: 'center' }}>Morphing Preview</h3>
          <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${viewBoxSize.x} ${viewBoxSize.y}`}></svg>
          <canvas ref={canvasRef} width={originalCanvasWidth} height={originalCanvasHeight} style={{ display: 'none' }}></canvas>
          <div style={{ marginLeft: "10px", display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <button style={{
              width: '350px',
              height: '40px',
              border: '2px solid #ccc',
              borderRadius: '4px',
              margin: 'auto',
              display: 'flex',
              fontSize: '18px',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              color: 'black',
              background: 'none',
              padding: 0,
              fontFamily: 'inherit',
            }} onClick={currentExportSetting.fileFormat === 'PNGs' ? handleFrameExport : handleVideoExport}>Export</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SVGMorph;