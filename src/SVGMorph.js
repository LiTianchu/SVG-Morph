import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { interpolate, interpolateAll } from 'flubber';

function SVGMorph({ svgs }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const pathsRef = useRef([]); // Store path elements to access them from button click
  const [viewBoxSize, setViewBoxSize] = useState({ x: 0, y: 0 });
  //const interpolatorsRef = useRef([]);

  useEffect(() => {
    console.log(svgs);

    //if (!svg1 || !svg2 ||!svg3) return;
    d3.select(svgRef.current).selectAll('*').remove();
    pathsRef.current = []; // Clear previous paths
    if (!svgs || svgs.length < 2) {
      return;
    }

    function getPathPoints(path) {
      // get the bounding box of the path
      const pathString = path;

      const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(tempSvg);

      const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tempPath.setAttribute('d', pathString);
      tempSvg.appendChild(tempPath);


      const pathLength = tempPath.getTotalLength();
      let points = [];

      for (let i = 0; i < pathLength; i += 1) { // Sample points every 1 units
        let { x, y } = tempPath.getPointAtLength(i);
        points.push([x, y]);
      }

      document.body.removeChild(tempSvg);
      return points;
    }

    const computeViewBox = (svgs) => {
      let sizeX = viewBoxSize.x;
      let sizeY = viewBoxSize.y;
      svgs.forEach(svgString => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        const viewBox = svgElement.getAttribute('viewBox');
        const svgViewBoxSize = viewBox.split(' ').slice(2);
        console.log("viewbox size: " + svgViewBoxSize);
        if (parseFloat(svgViewBoxSize[0]) > sizeX) {
          sizeX = svgViewBoxSize[0];
        }
        if (parseFloat(svgViewBoxSize[1]) > sizeY) {
          sizeY = svgViewBoxSize[1];
        }

      });
      setViewBoxSize({ x: sizeX, y: sizeY });
    }

    const getWindingOrder = (points) => {
      let sum = 0;
      // calculate signed area using shoelace theorem
      for (let i = 0; i < points.length; i++) {
        let [x1, y1] = points[i];
        let [x2, y2] = points[(i + 1) % points.length]; // loop back at the end
        sum += x1 * y2 - x2 * y1;
      }

      // note: in normal cartesian coordinates positive signed area = CCW, negative signed area = CW
      // but svg uses inverted y axis, so the result is inverted
      return sum > 0 ? "CW" : "CCW";
    }

    const pointArrToVector = (point) => {
      return {x: point[0], y: point[1]}
    }

    const countPointPolygonIntersection = (point, polygonPaths) => {
      //console.log("point: " + point);
      //console.log("polygon paths: " + polygonPaths);
      point = pointArrToVector(point);
      const ray = point.y; // horizontal ray y = point.y, assuming ray is pointing right
      console.log("ray: " + ray);
      let intersectionCount = 0;
      polygonPaths.forEach(polygon => {
        for (let i = 0; i < polygon.length; i++) {
          const vertex1 = pointArrToVector(polygon[i]);
          const vertex2 = pointArrToVector(polygon[(i + 1) % polygon.length]);
          let [p1, p2] = vertex1.y < vertex2.y ? [vertex1, vertex2] : [vertex2, vertex1]; // keep p1 above p2 (inverted y axis, so vertex1 is above if the y value is lesser)

          console.log("p1: " + p1 + " p2: " + p2);
          if (ray < p1.y || ray >= p2.y) { // ray is above or below the line segment, does not count
            console.log("ray is above or below the line segment, does not count");
            continue;
          }
          if (point.x > Math.max(p1.x, p2.x)) { // ray is to the right of the line segment, does not count
            console.log("ray is to the right of the line segment, does not count");
            continue;
          }

          const xDiff = p2.x - p1.x;
          if (xDiff === 0) { // vertical line
            intersectionCount++;
          } else {
            // construct the line equation
            const m = (p2.y - p1.y) / xDiff;
            const c = p1.y - m * p1.x;

            if (m === 0) { // horizontal line, does not count
              continue;
            } else { //normal condition
              const intersectX = (ray - c) / m;
              if (intersectX > point.x) {
                intersectionCount++;
              }
            }
          }
        }
      });
      return intersectionCount;
    }



    const computePathCenter = (path) => {
      // get the bounding box of the path
      const pathString = path;

      const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      document.body.appendChild(tempSvg);

      const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tempPath.setAttribute('d', pathString);
      tempSvg.appendChild(tempPath);

      const bBox = tempPath.getBBox();
      document.body.removeChild(tempSvg);
      return { x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height / 2 };
    };

    const isPathHole = (path, pathList, fillrule) => {
      const pathPoints = getPathPoints(path);
      console.log("Path points: " + pathPoints);
      if (fillrule == null) {
        return false;
      } else if (fillrule === 'evenodd') {
        // use point in polygon algorithm to determine if the path is a hole
        // if the point is inside an odd number of polygons except itself, it is a hole
        const filteredPaths = pathList.filter(p => p != path);
        const selectedPoint = pathPoints[0];
        console.log("selected point: " + selectedPoint);
        console.log("filtered paths: " + filteredPaths);
        const numOfIntersections = countPointPolygonIntersection(selectedPoint, filteredPaths.map(path => getPathPoints(path)));
        console.log("num of intersections: " + numOfIntersections);
        return numOfIntersections % 2 === 1;
      } else if (fillrule === 'nonzero') {
        const windingOrder = getWindingOrder(pathPoints);
        console.log("winding order: " + windingOrder + " \n" + "path: " + path);
        if (windingOrder === "CCW") {
          return true;
        }
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

    const getVector = (point1, point2) => {
      return { x: point2.x - point1.x, y: point2.y - point1.y };
    }


    const cleanPath = (path) => {
      // trim spaces
      path = path.trim();

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
      path.split('m').forEach((subPath, i) => {
        if (subPath.trim().slice(-1) !== 'z' && subPath.trim().slice(-1) !== 'Z') { // if this path is not closed
          subPath += "Z"; // close the path
        }
        if (i === 0) { // skip first one and record starting point
          const startingXCoordEndIndex = getNextElementEndIndex(subPath, 0);
          const startingYCoordEndIndex = getNextElementEndIndex(subPath, startingXCoordEndIndex);
          prevX = parseFloat(subPath.slice(0, startingXCoordEndIndex));
          prevY = parseFloat(subPath.slice(startingXCoordEndIndex, startingYCoordEndIndex));
          absoluteCoordPath += "M" + subPath;
          return;
        }


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
      console.log(absoluteCoordPath);
      return absoluteCoordPath;
    }



    const extractPaths = (svgString) => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      let pathList = Array.from(svgDoc.querySelectorAll(':scope > path')); // selects only path in the direct children
      let extractedPaths = [];

      //console.log("pathList: " + pathList);
      pathList.forEach((pathElement, i) => {
        let currentPathMasks = [];
        const path = pathElement.getAttribute('d')

        // check if path has a mask
        const maskAttr = pathElement.getAttribute('mask');
        const maskId = maskAttr != null ? maskAttr.slice(5, -1) : null;
        //console.log("maskid is: " + maskId);

        if (maskId != null) {
          const maskElement = svgDoc.getElementById(maskId);
          const maskPaths = Array.from(maskElement.querySelectorAll('path'));

          maskPaths.forEach((maskPathElement, i) => {
            const maskPath = maskPathElement.getAttribute('d');
            currentPathMasks.push(maskPath);
          });
        }

        console.log("mask paths: " + currentPathMasks);

        //const cleanedPath = cleanPath(path);
        const convertedAbsolutePath = cleanPath(path);


        // if path contains subpaths, split them into separate paths
        if (convertedAbsolutePath.includes('M')) {
          const subPaths = convertedAbsolutePath.split(/(?=M)/).filter(Boolean); // split at each 'M' while keeping it

          // check if the path contains holes as subpaths
          const fillRule = pathElement.getAttribute('fill-rule');
          //console.log("fill rule: " + fillRule);
          subPaths.forEach(subPath => {
            // if the subpath is a hole, add it to the mask paths
            if (isPathHole(subPath, subPaths, fillRule)) {
              currentPathMasks.push(subPath);
            }
          });

          subPaths.forEach(subPath => {
            if (!currentPathMasks.includes(subPath)) {
              extractedPaths.push({ mainPath: subPath, maskPaths: currentPathMasks });
            }
          });
        }

      });

      console.log(extractedPaths);
      return extractedPaths;
    };

    computeViewBox(svgs);

    const svgPathLists = svgs.map(extractPaths);

    // make all svgs have the same number of paths
    const maxPaths = Math.max(...svgPathLists.map(pathList => pathList.length));
    const maxMaskPathsNum = Math.max(...svgPathLists.flat().map(path => path.maskPaths.length));

    //console.log("max paths: " + maxPaths);
    //console.log("max mask paths: " + maxMaskPathsNum);
    for (let i = 0; i < svgPathLists.length; i++) {
      for (let j = svgPathLists[i].length; j < maxPaths; j++) {
        svgPathLists[i].push(svgPathLists[i][0]); // duplicate the first path
      }
    }



    if (svgPathLists.some(pathList => pathList.length === 0)) {
      console.error('No paths found in svg');
      return;
    }


    svgPathLists[0].forEach((mainMaskPair, i) => {
      let firstMainPath = mainMaskPair.mainPath;
      let firstMainPathMasks = [];
      for (let k = 0; k < maxMaskPathsNum; k++) {
        if (mainMaskPair.maskPaths[k] == null) {
          const center = computePathCenter(firstMainPath);
          firstMainPathMasks.push(`M${center.x},${center.y} Z`);
        } else {
          firstMainPathMasks.push(mainMaskPair.maskPaths[k]);
        }
      }


      const interpolators = svgPathLists.map((pathList, j) => {
        const path = pathList[i];
        const nextPairPath = svgPathLists[(j + 1) % svgPathLists.length][i];
        let fromPathList = [path.mainPath];
        let toPathList = [nextPairPath.mainPath];

        //const maskPaths = Math.max(path.maskPaths.length, nextPairPath.maskPaths.length);
        //console.log("mask paths: " + maxMaskPathsNum);
        console.log("from main path: " + path.mainPath);
        console.log("to main path: " + nextPairPath.mainPath);
        console.log("mask paths: " + path.maskPaths);
        console.log("next pair mask paths: " + nextPairPath.maskPaths);

        for (let k = 0; k < maxMaskPathsNum; k++) {
          if (path.maskPaths[k] == null) {
            // create a empty mask path
            console.log("from: empty mask path");
            const center = computePathCenter(path.mainPath);
            // add an empty path at the certer
            fromPathList.push(`M${center.x},${center.y} Z`);

          } else {
            console.log("from: " + path.maskPaths[k]);
            fromPathList.push(path.maskPaths[k]);
          }

          if (nextPairPath.maskPaths[k] == null) {
            // create a empty mask path
            console.log("to: empty mask path");
            const center = computePathCenter(nextPairPath.mainPath);
            // add an empty path at the certer
            toPathList.push(`M${center.x},${center.y} Z`);
          }
          else {
            console.log("to: " + nextPairPath.maskPaths[k]);
            toPathList.push(nextPairPath.maskPaths[k]);
          }

        }

        //console.log("from path list: " + fromPathList);
        //console.log("to path list: " + toPathList);
        let interpolators = { mainPathInterpolator: null, maskPathInterpolators: [] };

        const mainInterpolator = interpolate(fromPathList[0], toPathList[0], { maxSegmentLength: 0.1 });
        interpolators.mainPathInterpolator = mainInterpolator;

        for (let k = 1; k < fromPathList.length; k++) {
          const maskPathInterpolator = interpolate(fromPathList[k], toPathList[k], { maxSegmentLength: 0.1 });
          interpolators.maskPathInterpolators.push(maskPathInterpolator);
        }

        return interpolators;

      });
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
        .attr('fill', 'black')
        .attr('id', `path-${i}`)
        .attr('fill-rule', 'nonzero')
        .attr('mask', `url(#mask-${i})`);


      pathsRef.current.push({ pathElement, interpolators });

      function animateMainPath(interpolatorIdx) {
        d3.select(pathElement.node())
          .transition()
          .duration(1000)
          .attrTween('d', () => interpolators[interpolatorIdx].mainPathInterpolator)
          .on('end', () => animateMainPath((interpolatorIdx + 1) % interpolators.length));
      }

      function animateMaskPath(interpolatorIdx, pathIdx) {
        d3.select(maskTagElement.selectAll('path').nodes()[pathIdx])
          .transition()
          .duration(1000)
          .attrTween('d', () => interpolators[interpolatorIdx].maskPathInterpolators[pathIdx])
          .on('end', () => animateMaskPath((interpolatorIdx + 1) % interpolators.length, pathIdx));

      }

      // foreach mask paths elements, apply the inerpolation
      firstMainPathMasks.forEach((maskPath, k) => {
        animateMaskPath(0, k);
      });

      animateMainPath(0);
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
      <svg ref={svgRef} width="100%" height="100%" viewBox={"0 0 " + viewBoxSize.x + " " + viewBoxSize.y}></svg>
      <button onClick={handleFrameExport}>Export Frames</button>
      <canvas ref={canvasRef} width="500" height="500" style={{ display: 'none' }}></canvas>
    </div>
  );
}

export default SVGMorph;
