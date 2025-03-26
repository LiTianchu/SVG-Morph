import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { interpolate } from 'flubber';
import PathUtils from './PathUtils';
import MiscUtils from './MiscUtils';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import PolygonUtils from './PolygonUtils';

function SVGMorph({ svgs, morphSetting, onLoadingStateChange }) {
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
    oneToMany: 'duplicate'
  });
  const [currentSvgs, setCurrentSvgs] = useState([]);

  useEffect(() => {
    if (morphSetting.oneToMany === currentMorphSetting.oneToMany &&
      morphSetting.quality === currentMorphSetting.quality &&
      currentSvgs === svgs) {
      setCurrentSvgs(svgs);
      setCurrentMorphSetting(morphSetting);
      return;
    } else {
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
      //console.log("Num of SVGs less than 2, abort morphing");
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

      //console.log("max paths: " + maxPaths);
      //console.log("max mask paths: " + maxMaskPathsNum);
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
      const pairByArea = false;
      const interpolatorsToEnd = svgPathLists.map((pathList, j) => {
        // pathList is the list of paths of the j-th svg
        const path = pathList[selectedPathIndex]; // current path

        used[j][selectedPathIndex] = true; // mark the path as used

        if (pairByArea) {

          if (j === svgPathLists.length - 1) { // if this is the last svg
            // loop back to the initial path
            selectedPathIndex = initialPathIndex; // set the next pair path index
          } else { // choose the next pair path based on area difference

            // find the suitable pair path index by 
            const nextSvgPathList = svgPathLists[(j + 1) % svgPathLists.length];
            let smallestAbsAreaDiff = Number.MAX_VALUE;
            let nextPairPathIndex = -1;

            nextSvgPathList.forEach((nextSvgPath, nextPIndex) => {
              if (!used[(j + 1)][nextPIndex]) { // if this path is not marked as used
                // compute the area difference between the two paths
                const pathArea = PolygonUtils.computePolygonArea(path.mainPathPoints);
                const nextPathArea = PolygonUtils.computePolygonArea(nextSvgPath.mainPathPoints);
                const absAreaDiff = Math.abs(pathArea - nextPathArea);
                if (absAreaDiff < smallestAbsAreaDiff) {
                  smallestAbsAreaDiff = absAreaDiff;
                  nextPairPathIndex = nextPIndex;
                }
              }
            });

            if (nextPairPathIndex === -1) {
              console.error("No suitable pair path found for svg " + j + " path at index " + pathIndex);
              return;
            }

            selectedPathIndex = nextPairPathIndex; // set the next pair path index
          }
        }


        const nextPairPath = svgPathLists[(j + 1) % svgPathLists.length][selectedPathIndex]; // next pair path
        let fromPathList = [path.mainPath];
        let toPathList = [nextPairPath.mainPath];
        const fromStroke = path.strokeData;
        const toStroke = nextPairPath.strokeData;
        const fromFillColor = path.fillColor;
        const toFillColor = nextPairPath.fillColor;

        //const maskPaths = Math.max(path.maskPaths.length, nextPairPath.maskPaths.length);
        //console.log("mask paths: " + maxMaskPathsNum);
        //console.log("from main path: " + path.mainPath);
        //console.log("to main path: " + nextPairPath.mainPath);
        //console.log("mask paths: " + path.maskPaths);
        //console.log("next pair mask paths: " + nextPairPath.maskPaths);

        // fill in the missing mask paths for both from and to paths
        const maxMaskPathsNum = Math.max(...svgPathLists.flat().map(path => path.maskPaths.length));
        for (let k = 0; k < maxMaskPathsNum; k++) {
          if (path.maskPaths[k] == null) {
            // create a empty mask path
            //console.log("from: empty mask path");
            const center = PathUtils.computePathCenter(path.mainPath);
            // add an empty path at the certer
            fromPathList.push(`M${center.x},${center.y} Z`);

          } else {
            //console.log("from: " + path.maskPaths[k]);
            fromPathList.push(path.maskPaths[k]);
          }

          if (nextPairPath.maskPaths[k] == null) {
            // create a empty mask path
            //console.log("to: empty mask path");
            const center = PathUtils.computePathCenter(nextPairPath.mainPath);
            // add an empty path at the certer
            toPathList.push(`M${center.x},${center.y} Z`);
          }
          else {
            //console.log("to: " + nextPairPath.maskPaths[k]);
            toPathList.push(nextPairPath.maskPaths[k]);
          }

        }

        //console.log("from path list: " + fromPathList);
        //console.log("to path list: " + toPathList);
        let interpolators = { mainPathInterpolator: null, maskPathInterpolators: [], fillColorInterpolator: null, stokeColorInterpolator: null, strokeWidthInterpolator: null, strokeOpacityInterpolator: null };
        //console.log("max segment length: " + sizeX / 100);
        //console.log("generating interpolators for main path at index " + pathIndex + " timestamp: " + (new Date().getTime() - timeElapsed));

        // generate interpolators for main path
        const mainInterpolator = interpolate(fromPathList[0], toPathList[0], { maxSegmentLength: maxSegmentLength });
        interpolators.mainPathInterpolator = mainInterpolator;

        //console.log("generating interpolators for mask path at index " + pathIndex + " timestamp: " + (new Date().getTime() - timeElapsed));

        // generate interpolators for mask paths
        for (let k = 1; k < fromPathList.length; k++) {
          const maskPathInterpolator = interpolate(fromPathList[k], toPathList[k], { maxSegmentLength: maxSegmentLength });
          interpolators.maskPathInterpolators.push(maskPathInterpolator);
        }

        interpolators.fillColorInterpolator = d3.interpolateRgb(fromFillColor, toFillColor);
        //console.log("from stroke: " + fromStroke.strokeColor + " , to stroke: " + toStroke.strokeColor);
        //console.log("from stroke width: " + fromStroke.strokeWidth + " , to stroke width: " + toStroke.strokeWidth);
        //console.log("from stroke opacity: " + fromStroke.strokeOpacity + " , to stroke opacity: " + toStroke.strokeOpacity);
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
      //await new Promise((resolve) => setTimeout(resolve, 2000));

      const newViewBoxSize = computeViewBox();
      const maxSegmentLength = newViewBoxSize.x / (morphSetting.quality * 10);
      let svgPathLists = extractPath(svgs);
      svgPathLists = standardizePathNum(svgPathLists, newViewBoxSize);

      const maxMaskPathsNum = Math.max(...svgPathLists.flat().map(path => path.maskPaths.length));
      console.log(svgPathLists);
      // iterate over each path of the first svg to generate the set of interpolators
      svgPathLists[0].forEach((mainMaskPair, i) => {
        const firstMainPath = mainMaskPair.mainPath;
        const firstFillColor = mainMaskPair.fillColor;
        const firstStroke = mainMaskPair.strokeData;
        //console.log("first main path: ");
        //console.log(firstStroke);

        let firstMainPathMasks = [];
        for (let k = 0; k < maxMaskPathsNum; k++) {
          if (mainMaskPair.maskPaths[k] == null) {
            const center = PathUtils.computePathCenter(firstMainPath);
            firstMainPathMasks.push(`M${center.x},${center.y} Z`);
          } else {
            firstMainPathMasks.push(mainMaskPair.maskPaths[k]);
          }
        }
        const used = Array.from({ length: svgs.length }, () => Array.from({ length: svgPathLists[0].length }, () => false)); // table to mark used paths used[j][i] = true if the i-th path of the j-th svg is used
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

        //console.log("initial path element: " + pathElement.node());

        // push the starting path element and the series of interpolators to the end
        pathsRef.current.push({ pathElement, maskTagElement, interpolatorsToEnd });
      });

      onLoadingStateChange(false, false, { text: "Finished setting up interpolation, triggering animation..." });
      console.log("finished setting up interpolation timestamp: " + (new Date().getTime() - timeElapsed));
      //await new Promise((resolve) => setTimeout(resolve, 2000));
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

    //console.log("triggering animation");
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
      //console.log(pathAndInterpolators);
      const pathElement = pathAndInterpolators.pathElement;
      const maskTagElement = pathAndInterpolators.maskTagElement;
      const interpolatorsToEnd = pathAndInterpolators.interpolatorsToEnd;
      animateMainPath(pathElement, interpolatorsToEnd, 0);

      maskTagElement.selectAll('path').nodes().forEach((_, k) => {
        animateMaskPath(maskTagElement, interpolatorsToEnd, 0, k);
      })
    });

  }, [initialized, morphSetting, svgs]);

  const saveImage = (dataUrl, fileName) => {
    // save to disk for testing
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const getFrameQueue = (frameCount) => {
    const svg = d3.select(svgRef.current);
    const numOfMorphs = pathsRef.current[0].interpolatorsToEnd.length;
    const numOfMaskPathsPerNormalPath = pathsRef.current[0].interpolatorsToEnd[0].maskPathInterpolators.length;
    console.log("num of morphs: " + numOfMorphs);
    // get the easing function from the morph setting
    const d3Easing = MiscUtils.getD3Easing(morphSetting.easing);
    const downloadQueue = [];
    for (let m = 0; m < numOfMorphs; m++) {
      const numFrames = frameCount; // 24 frames per second
      const frames = Array.from({ length: numFrames }, (_, i) => i / (numFrames - 1));
      frames.forEach((t, frameIndex) => {
        // get the eased time
        const tEased = d3Easing(t);

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
    const cWidth = canvasRef.current.width * scaleFactor;
    const cHeight = canvasRef.current.height * scaleFactor;

    // resize canvas based on scale factor
    canvasRef.current.width = cWidth;
    canvasRef.current.height = cHeight;
  }

  const handleFrameExport = () => {
    const context = canvasRef.current.getContext('2d');

    const scaleFactor = 2; // scale factor for canvas
    const numFrames = 30; // frames per second

    rescaleCanvas(scaleFactor);
    const downloadQueue = getFrameQueue(numFrames);

    // process export queue sequentially
    const processQueue = () => {
      if (downloadQueue.length === 0) { return; }
      const { img, m, frameIndex } = downloadQueue.shift();
      console.log("exporting: " + `image-morph${m}-frame${frameIndex}.png`);
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      context.drawImage(img, 0, 0);
      const pngDataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = `image-morph${m}-frame${frameIndex}.png`;
      link.click();
      setTimeout(processQueue, 100);
    }

    processQueue();
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

  const sleep = (time) => {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  // TODO: make framerate and scale adjustable
  //  button handler to export video using ffmpeg
  const handleVideoExport = async () => {
    // use local WASM file and core from public directory
    const localWasmPath = '/ffmpeg-core.wasm';
    const localCorePath = '/ffmpeg-core.js';

    console.log("Loading ffmpeg-core from:", localWasmPath);

    const separated = false;
    const scaleFactor = 2; // scale factor for canvas
    const numFrames = 30; // frames per second

    // scale canvas for export
    rescaleCanvas(scaleFactor);

    const ffmpegInstance = new FFmpeg();
    await ffmpegInstance.load({ log: true, coreURL: localCorePath, wasmURL: localWasmPath });
    console.log("ffmpeg loaded");

    const numOfMorphs = pathsRef.current[0].interpolatorsToEnd.length;
    console.log("creating video");

    // generate the sequence of frames
    const frameQueue = getFrameQueue(numFrames);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    for (const { img, m, frameIndex } of frameQueue) {
      // ensure image is loaded before drawing
      if (!img.complete) {
        await new Promise((resolve) => { img.onload = resolve; });
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');
      const data = dataURLtoUint8Array(dataUrl);

      let fileName;
      if (separated) {
        fileName = `morph${m}_frame${String(frameIndex).padStart(9, "0")}.png`;
      } else {
        fileName = `frame${String(frameIndex + numFrames * m).padStart(9, "0")}.png`;
      }

      //saveImage(dataUrl, fileName);

      // write frame data to ffmpeg FS
      await ffmpegInstance.writeFile(fileName, data);
      console.log("writing file: " + fileName);
    }

    // after writing all frames, encode the video(s)
    if (separated) {
      for (let m = 0; m < numOfMorphs; m++) {
        const outputFile = `morph${m}.mp4`;
        await ffmpegInstance.exec([
          '-framerate', `${numFrames}`,
          '-i', `morph${m}_frame%09d.png`,
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-f', 'mp4',
          outputFile
        ]);
        console.log("executed ffmpeg for morph " + m);

        const videoData = await ffmpegInstance.readFile(outputFile);
        const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(videoBlob);

        // trigger download of separated video clip
        const link = document.createElement('a');
        link.href = url;
        link.download = outputFile;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("downloaded video: " + outputFile);
      }
    } else {
      const outputFile = 'morph.mp4';
      await ffmpegInstance.exec([
        '-framerate', `${numFrames}`,
        '-i', 'frame%09d.png', // all frames from all morphs
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-f', 'mp4',
        outputFile
      ]);
      console.log("executed ffmpeg for combined video");

      const videoData = await ffmpegInstance.readFile(outputFile);
      const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);

      // trigger download of the combined video
      const link = document.createElement('a');
      link.href = url;
      link.download = outputFile;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log("downloaded video: " + outputFile);
    }

    // clean up ffmpeg virtual FS files
    const files = await ffmpegInstance.listDir('/');
    for (const file of files) {
      if (file.name && (file.name.endsWith('.png') || file.name.endsWith('.mp4'))) {
        try {
          await ffmpegInstance.deleteFile(file.name);
          console.log("cleaned file: " + file.name);
        } catch (e) {
          console.error("Error deleting file:", file.name, e);
        }
      }
    }
  };

  return (
    <div style={{ position: "absolute", width: "100%", height: "100%" }}>
      <div style={{ display: isMorphing ? 'flex' : 'none', justifyContent: 'space-around', alignItems: 'center' }}>
        <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${viewBoxSize.x} ${viewBoxSize.y}`}></svg>
        <button onClick={handleFrameExport}>Export Frames</button>
        <button onClick={handleVideoExport}>Export Video</button>
        <canvas ref={canvasRef} width="500" height="500" style={{ display: 'none' }}></canvas>
      </div>
    </div>
  );
}

export default SVGMorph;