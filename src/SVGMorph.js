import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { interpolate } from 'flubber';

function SVGMorph({ svgs }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const pathsRef = useRef([]); // Store path elements to access them from button click
  //const interpolatorsRef = useRef([]);

  useEffect(() => {
    console.log(svgs);
    //if (!svg1 || !svg2 ||!svg3) return;
    d3.select(svgRef.current).selectAll('*').remove();
    pathsRef.current = []; // Clear previous paths
    if (!svgs || svgs.length < 2) {
      return;
    }

    const toCommandArray = (path) => {
      for (let i = 0; i < path.length; i++) {
        // use regex to detect command

      }
    }

    const getNextElementEndIndex = (path, index) => {
      let currentIndex = index;
      const pathLength = path.length;
      while (currentIndex < pathLength) {
        const char = path[currentIndex];
        if (char === ' ' || char === ',') {
          currentIndex++;
          continue;
        }

        if (/^[0-9.-]$/.test(char)) { // if this char marks the start of a positive or negative number
          // get next index of non-number or end of string
          if (char === '-') {
            currentIndex++;
          }
          const nextNonNumberIndex = path.slice(currentIndex).search(/[^0-9.]/);

          if (nextNonNumberIndex === -1) { // return end of string
            return pathLength + 1;
          }

          return currentIndex + nextNonNumberIndex; // return the end index of the extracted number
        } else { // char is a command
          return currentIndex + 1;
        }
      }
      return pathLength + 1; // end of string
    }


    const cleanPath = (path) => {
      return path.trim();
    }

    const convertRelativeToAbsolute = (path) => {
      if (path[0] === 'M' || path[0] === 'm') {
        // first m is same as M, remove it
        path = path.slice(1);
      }

      if (!path.includes('m')) { // if path does not contain relative coordinates, simply return it
        return "M".concat(path);
      }

      let absoluteCoordPath = "";
      let prevX = 0, prevY = 0;

      // convert relative coordinates to absolute coordinates
      //const pathArray = ;
      path.split('m').forEach((subPath, i) => {
        if (i === 0) { // skip first one and record starting point
          const startingXCoordEndIndex = getNextElementEndIndex(subPath, 0);
          const startingYCoordEndIndex = getNextElementEndIndex(subPath, startingXCoordEndIndex);
          prevX = parseFloat(subPath.slice(0, startingXCoordEndIndex));
          prevY = parseFloat(subPath.slice(startingXCoordEndIndex, startingYCoordEndIndex));
          absoluteCoordPath += "M" + subPath;
          return;
        }

        // if (pathArray[i - 1].trim().slice(-1) !== 'z' && pathArray[i - 1].trim().slice(-1) !== 'Z') { // if previous path is not closed
        //   // TODO: unclosed path handling
        // }

        // M coordinate should be previous M coordinate + current m coordinate
        const xCoordEndIndex = getNextElementEndIndex(subPath, 0);
        const yCoordEndIndex = getNextElementEndIndex(subPath, xCoordEndIndex);
        const xCoord = subPath.slice(0, xCoordEndIndex);
        const yCoord = subPath.slice(xCoordEndIndex, yCoordEndIndex);

        let newPath = subPath.slice(yCoordEndIndex);

        const newXCoord = prevX + parseFloat(xCoord);
        const newYCoord = prevY + parseFloat(yCoord);
        prevX = newXCoord;
        prevY = newYCoord;

        newPath = newXCoord + (newYCoord < 0 ? "" : " ") + newYCoord + newPath;
        absoluteCoordPath += "M" + newPath;
      });

      return absoluteCoordPath;
    }

    const extractPaths = (svgString) => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      let pathList = Array.from(svgDoc.querySelectorAll('path')).map(path => path.getAttribute('d'));
      let extractedPaths = [];
      pathList.forEach((path, i) => {
        const cleanedPath = cleanPath(path);
        const convertedAbsolutePath = convertRelativeToAbsolute(cleanedPath);
        // if path contains subpaths, split them into separate paths
        if (convertedAbsolutePath.includes('M')) {
          const subPaths = convertedAbsolutePath.split(/(?=M)/).filter(Boolean); // split at each 'M' while keeping it
          extractedPaths.push(...subPaths);

        } else {
          extractedPaths.push(convertedAbsolutePath);
        }
      });
      return extractedPaths;
    };

    const svgPathLists = svgs.map(extractPaths);

    // make all svgs have the same number of paths
    const maxPaths = Math.max(...svgPathLists.map(pathList => pathList.length));
    for (let i = 0; i < svgPathLists.length; i++) {
      if (svgPathLists[i].length < maxPaths) {
        for (let j = svgPathLists[i].length; j < maxPaths; j++) {
          svgPathLists[i].push(svgPathLists[i][0]);
        }
      }
    }

    if (svgPathLists.some(pathList => pathList.length === 0)) {
      console.error('No paths found in svg');
      return;
    }

    svgPathLists[0].forEach((path, i) => {
      const interpolators = svgPathLists.map((pathList, j) => {
        return interpolate(pathList[i], svgPathLists[(j + 1) % svgPathLists.length][i], { maxSegmentLength: 0.1 });
      });

      const pathElement = d3.select(svgRef.current).append('path')
        .attr('d', path)
        .attr('fill', 'black')
        .attr('id', `path-${i}`);

      pathsRef.current.push({ pathElement, interpolators });

      function animate(interpolatorIdx) {
        d3.select(pathElement.node())
          .transition()
          .duration(2000)
          .attrTween('d', () => interpolators[interpolatorIdx])
          .on('end', () => animate((interpolatorIdx + 1) % interpolators.length));
      }

      animate(0);
    });


    return () => {
      d3.select(svgRef.current).selectAll('*').interrupt();
    };
  }, [svgs]);

  // Button click handler to start animation on all paths
  function handleFrameExport() {
    const numFrames = 5;
    const context = canvasRef.current.getContext('2d');
    const svg = d3.select(svgRef.current);

    // Create frames at intervals from 0 to 1
    const frames = Array.from({ length: numFrames }, (_, i) => i / (numFrames - 1)); // frames = [0, 0.25, 0.5, 0.75, 1];
    frames.forEach((t, frameIndex) => {
      svg.selectAll('path').each(function (d, i) {
        const path = d3.select(this);
        const interpolator = pathsRef.current[i].interpolatorTo2;
        path.attr('d', interpolator(t));
      });

      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;

      img.onload = () => {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        context.drawImage(img, 0, 0);
        const pngDataUrl = canvasRef.current.toDataURL('image/png');

        const link = document.createElement('a');
        link.href = pngDataUrl;
        link.download = `frame-${frameIndex}.png`;
        link.click();
      };
    });
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
      <svg ref={svgRef} width="500" height="500" viewBox="0 0 30 30"></svg>
      <button onClick={handleFrameExport}>Export Frames</button>
      <canvas ref={canvasRef} width="500" height="500" style={{ display: 'none' }}></canvas>
    </div>
  );
}

export default SVGMorph;
