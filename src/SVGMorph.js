import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { interpolate } from 'flubber';
import PathUtils from './PathUtils';
import MiscUtils from './MiscUtils';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import PolygonUtils from './PolygonUtils';

function SVGMorph({ svgs, morphSetting, onLoadingStateChange }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const pathsRef = useRef([]); // Store path elements to access them from button click
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
          if (morphSetting.oneToMany === 'duplicate') {
            const dupIndex = j % initialPathNum;
            console.log("duplicating path at " + j+ "%" + initialPathNum + " - " + dupIndex + " for svg " + i);
            svgPathLists[i].push(svgPathLists[i][dupIndex]); // duplicate the path
            //svgPathLists[i].push(svgPathLists[i][0]); // duplicate the first path
          } else if (morphSetting.oneToMany === 'appear') {
            svgPathLists[i].push({ mainPath: `M${vbSize.x / 2},${vbSize.y / 2} Z`, maskPaths: [], fillColor: "black" }); // add an empty path
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
        let interpolators = { mainPathInterpolator: null, maskPathInterpolators: [], fillColorInterpolator: null };
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

      // iterate over each path of the first svg to generate the set of interpolators
      svgPathLists[0].forEach((mainMaskPair, i) => {
        let firstMainPath = mainMaskPair.mainPath;
        let firstFillColor = mainMaskPair.fillColor;
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

  // Button click handler to start animation on all paths
  const handleFrameExport = () => {
    const context = canvasRef.current.getContext('2d');
    const svg = d3.select(svgRef.current);
    console.log(pathsRef.current);
    const numOfMorphs = pathsRef.current[0].interpolatorsToEnd.length;
    const numOfMaskPathsPerNormalPath = pathsRef.current[0].interpolatorsToEnd[0].maskPathInterpolators.length;
    console.log("num of morphs: " + numOfMorphs);

    const downloadQueue = [];
    for (let m = 0; m < numOfMorphs; m++) {

      // create frames at intervals from 0 to 1
      const numFrames = 24; // 24 frames per second
      const frames = Array.from({ length: numFrames }, (_, i) => i / (numFrames - 1)); // e.g. numFrames = 5, frames = [0, 0.25, 0.5, 0.75, 1];
      frames.forEach((t, frameIndex) => {
        svg.selectAll(':scope > path').each(function (_, i) {
          const path = d3.select(this);
          //console.log(i);
          //console.log(pathsRef.current[i]);
          const interpolators = pathsRef.current[i].interpolatorsToEnd;
          // print the interpolators object
          console.log("m: " + m);
          console.log(interpolators);
          path.attr('d', interpolators[m].mainPathInterpolator(t));
          path.attr('fill', interpolators[m].fillColorInterpolator(t));
        });

        // interpolate mask paths
        svg.selectAll('mask path').each(function (_, i) {
          const maskPath = d3.select(this);
          const pathIndex = Math.floor(i / numOfMaskPathsPerNormalPath);
          const maskPathIndex = i % numOfMaskPathsPerNormalPath;
          const interpolators = pathsRef.current[pathIndex].interpolatorsToEnd;
          maskPath.attr('d', interpolators[m].maskPathInterpolators[maskPathIndex](t));
        });

        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;

        downloadQueue.push({ img, m, frameIndex });
      });
    }

    const processQueue = () => {
      if (downloadQueue.length === 0) { return; }

      const { img, m, frameIndex } = downloadQueue.shift(); // dequeue by remove first element from the array
      console.log("image downloaded: " + `image-morph${m}-frame${frameIndex}.png`);
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      context.drawImage(img, 0, 0);
      const pngDataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = `image-morph${m}-frame${frameIndex}.png`;
      link.click();
      setTimeout(processQueue, 100); // Process the next item in the queue after a short delay
    }

    processQueue();
  }

  return (
    <div style={{ position: "absolute", width: "100%", height: "100%" }}>
      <div style={{ display: isMorphing ? 'flex' : 'none', justifyContent: 'space-around', alignItems: 'center' }}>
        <svg ref={svgRef} width="100%" height="100%" viewBox={"0 0 " + viewBoxSize.x + " " + viewBoxSize.y}></svg>
        <button onClick={handleFrameExport}>Export Frames</button>
        <canvas ref={canvasRef} width="500" height="500" style={{ display: 'none' }}></canvas>
      </div>
    </div>
  );
}

export default SVGMorph;
