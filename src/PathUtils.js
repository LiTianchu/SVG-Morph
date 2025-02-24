import pathConverter from "./PathConverter";
import polygonUtils from "./PolygonUtils";

const getWidthHeight = (svgElement) => {
    const width = svgElement.width.baseVal.value || parseFloat(svgElement.getAttribute('width')) || svgElement.viewBox.baseVal.width;
    const height = svgElement.height.baseVal.value || parseFloat(svgElement.getAttribute('height')) || svgElement.viewBox.baseVal.height;
    return { width: width, height: height };
}

const getBBox = (path) => {
    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.appendChild(tempSvg);

    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempPath.setAttribute('d', path);
    tempSvg.appendChild(tempPath);

    const bBox = tempPath.getBBox();
    document.body.removeChild(tempSvg);
    return bBox;
}

const computePathCenter = (path) => {
    // get the bounding box of the path
    const bBox = getBBox(path);
    return { x: bBox.x + bBox.width / 2, y: bBox.y + bBox.height / 2 };
};

const getPathPoints = (path) => {
    //let timeElapsed = new Date().getTime();
    // get the bounding box of the path
    const pathString = path;

    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.appendChild(tempSvg);

    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempPath.setAttribute('d', pathString);
    tempSvg.appendChild(tempPath);


    const pathLength = tempPath.getTotalLength();
    let points = [];

    for (let i = 0; i < pathLength; i += 1) { // sample points every 1 units
        let { x, y } = tempPath.getPointAtLength(i);
        points.push([x, y]);
    }

    document.body.removeChild(tempSvg);
    //console.log("get path point took " + (new Date().getTime() - timeElapsed) + "ms");
    return points;
}

const isPathHole = (selectedPoint, pathPoints, otherPathPoints, outerContourPoints, fillrule) => {
    //let timeElapsed = new Date().getTime();
    //const pathPoints = getPathPoints(path);
    //const outerContourPoints = getPathPoints(outerContour);
    const outerContourWindingOrder = polygonUtils.getWindingOrder(outerContourPoints);

    //console.log("Path points: " + pathPoints);
    //const filteredPaths = pathList.filter(p => p != path);
    //let selectedPoint = pathPoints[0];
    // if (selectedPoint == null || selectedPoint == undefined) {
    //     //console.log("selected point is null, choosing the first point of the path");
    //     const commandIndex = getNextElementEndIndex(path, 0); // M
    //     const xCoordEndIndex = getNextElementEndIndex(path, commandIndex);
    //     const yCoordEndIndex = getNextElementEndIndex(path, xCoordEndIndex);

    //     selectedPoint = [parseFloat(path.slice(commandIndex, xCoordEndIndex)),
    //     parseFloat(path.slice(xCoordEndIndex, yCoordEndIndex))];
    //     return;
    // }


    //console.log("selected point: " + selectedPoint);
    //console.log("filtered paths: " + filteredPaths);
    const numOfIntersections = polygonUtils.countPointPolygonIntersection(selectedPoint, otherPathPoints);
    //console.log("num of intersections: " + numOfIntersections);

    //console.log("isPathHole took " + (new Date().getTime() - timeElapsed) + "ms");
    if (fillrule === 'evenodd') {
        // use point in polygon algorithm to determine if the path is a hole
        // if the point is inside an odd number of polygons except itself, it is a hole
        return numOfIntersections % 2 === 1;
    } else { // non-zero fill rule
        const windingOrder = polygonUtils.getWindingOrder(pathPoints);
        //console.log("winding order: " + windingOrder + " \n" + "path: " + path);
        // if the point is inside an odd number of polygons except itself plus the outer coutour has different winding order, it is a hole
        return windingOrder !== outerContourWindingOrder && numOfIntersections % 2 === 1;
    }
}

const getNextElementEndIndex = (path, index) => {
    let currentIndex = index;
    const pathLength = path.length;
    while (currentIndex < pathLength) {
        const char = path[currentIndex];
        if (char === ' ' || char === ',') {
            // replace comma with space
            currentIndex++;
            continue;
        }

        if (/^[0-9.-]$/.test(char)) { // if this char marks the start of a positive or negative number
            // get next index of non-number or end of string
            if (char === '-' || char === '+') { // skip the sign
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
    //let timeElapsed = new Date().getTime();
    // trim spaces
    path = path.trim();
    // replace all comma with space
    path = path.replace(/,/g, ' ');

    if (!path.includes('m')) { // if path does not contain relative coordinates, simply return it
        return path;
    }

    let absoluteCoordPath = "";
    let prevX = 0, prevY = 0;

    // convert relative coordinates to absolute coordinates
    path.split(/(?=[mM])/).forEach((subPath, i) => { // split m or M while keeping it
        const command = subPath[0];
        subPath = subPath.slice(1); // remove the command

        if (subPath.trim().slice(-1) !== 'z' && subPath.trim().slice(-1) !== 'Z') { // if this path is not closed
            subPath += "Z"; // close the path
        }
        if (command === 'M') { // skip first one and record starting point
            const startingXCoordEndIndex = getNextElementEndIndex(subPath, 0);
            const startingYCoordEndIndex = getNextElementEndIndex(subPath, startingXCoordEndIndex);
            prevX = parseFloat(subPath.slice(0, startingXCoordEndIndex));
            prevY = parseFloat(subPath.slice(startingXCoordEndIndex, startingYCoordEndIndex));
            //console.log("subpath: " + subPath);
            //console.log(subPath.slice(startingXCoordEndIndex, startingYCoordEndIndex));
            //console.log("startingXCoordEndIndex: " + startingXCoordEndIndex);
            //console.log("startingYCoordEndIndex: " + startingYCoordEndIndex);
            //console.log("starting point: " + prevX + "," + prevY);
            absoluteCoordPath += "M" + subPath;
            return;
        }


        if (command === 'm') {
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
            //console.log("command is m therefore converted new absolute path: \n" + "M" + newPath);
        } else {
            absoluteCoordPath += "M" + subPath;
            //console.log("command is M therefore old subpath: \n" + "M" + subPath);

        }
    });
    //console.log(absoluteCoordPath);
    //console.log("cleanPath took " + (new Date().getTime() - timeElapsed) + "ms");
    return absoluteCoordPath;
}

const getColorFromSvgElement = (pathElement) => {
    let fillColor = pathElement.getAttribute('fill');
    if (fillColor == null) {
        // try find style attribute
        const style = pathElement.getAttribute('style');
        if (style != null) {
            // get fill: value
            const fillIndex = style.indexOf('fill:');
            if (fillIndex !== -1) {
                const fillValue = style.slice(fillIndex + 5, style.indexOf(';', fillIndex));
                fillColor = fillValue;
            }
        }

    }
    return fillColor;
}

const rawPathStringToPathElement = (pathString) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathString}"/></svg>`, 'image/svg+xml');
    return svgDoc.documentElement.getElementsByTagName('path')[0];
}

const extractPaths = (svgString) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const parentFillColor = getColorFromSvgElement(svgDoc.documentElement);
    //let pathList = Array.from(svgDoc.querySelectorAll(':scope > path')); // selects only path in the direct children
    let pathList = Array.from(svgDoc.querySelectorAll(':scope > path, :scope > rect, :scope > circle, :scope > ellipse, :scope > line, :scope > polyline, :scope > polygon')); // selects only path in the direct children
    let extractedPaths = [];

    //console.log("pathList: " + pathList);
    //convert non path elements to path elements
    pathList.forEach((pathElement, i) => {
        let currentPathMasks = [];

        if (pathElement.tagName !== 'path') {
            let convertedPathString = null;
            switch (pathElement.tagName) {
                case 'rect':
                    convertedPathString = pathConverter.rectToPath(pathElement);
                    break;
                case 'circle':
                    convertedPathString = pathConverter.circleToPath(pathElement);
                    break;
                case 'ellipse':
                    convertedPathString = pathConverter.ellipseToPath(pathElement);
                    break;
                case 'line':
                    convertedPathString = pathConverter.lineToPath(pathElement);
                    break;
                case 'polyline':
                    convertedPathString = pathConverter.polylineToPath(pathElement);
                    break;
                case 'polygon':
                    convertedPathString = pathConverter.polygonToPath(pathElement);
                    break;
                default: console.log("unsupported path element tag: " + pathElement.tagName);
            }
            pathElement = rawPathStringToPathElement(convertedPathString);
        }

        const path = pathElement.getAttribute('d')
        let color = getColorFromSvgElement(pathElement);
        //console.log("color: " + color);
        if (color == null) {
            color = parentFillColor;
        }


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

        //console.log("mask paths: " + currentPathMasks);

        //const cleanedPath = cleanPath(path);
        const convertedAbsolutePath = cleanPath(path);


        // if path contains subpaths, split them into separate paths
        if (convertedAbsolutePath.includes('M')) {
            const subPaths = convertedAbsolutePath.split(/(?=M)/).filter(Boolean); // split at each 'M' while keeping it

            // check if the path contains holes as subpaths
            const fillRule = pathElement.getAttribute('fill-rule');
            let outerContour = null;
            let outerContourPoints = null;
            let subPathData = []
            subPaths.forEach((subPath, i) => {
                //console.log("subpath debug: " + subPath);
                let pathPoints = getPathPoints(subPath);
                let selectedPoint = pathPoints[0];
                if (selectedPoint == null || selectedPoint == undefined) {
                    //console.log("selected point is null, choosing the first point of the path");
                    const commandIndex = getNextElementEndIndex(subPath, 0); // M
                    const xCoordEndIndex = getNextElementEndIndex(subPath, commandIndex);
                    const yCoordEndIndex = getNextElementEndIndex(subPath, xCoordEndIndex);

                    selectedPoint = [parseFloat(subPath.slice(commandIndex, xCoordEndIndex)),
                    parseFloat(subPath.slice(xCoordEndIndex, yCoordEndIndex))];
                    subPathData.push({ points: pathPoints, subPath: subPath, firstPoint: selectedPoint });
                    return;
                }else{
                    subPathData.push({ points: pathPoints, subPath: subPath, firstPoint: selectedPoint });
                }

                //console.log(selectedPoint);
                const filteredPathData = subPathData.filter(p => p.subPath != subPath);

                const numOfIntersections = polygonUtils.countPointPolygonIntersection(selectedPoint, filteredPathData.map(p => p.points));
                if (numOfIntersections % 2 === 0) { // if the point is outside an even number of polygon line segments, it is the outer contour
                    outerContour = subPath;
                    outerContourPoints = subPathData[i].points;
                    //console.log("found outer contour: " + outerContour);
                    return;
                }
            });

            subPaths.forEach((subPath, i) => {
                // if the subpath is a hole, add it to the mask paths
                const filteredPathData = subPathData.filter(p => p.subPath != subPath);
                if (isPathHole(subPathData[i].firstPoint, subPathData[i].points,filteredPathData.map(p => p.points), outerContourPoints, fillRule)) {
                    currentPathMasks.push(subPath);
                }
            });

            subPaths.forEach(subPath => {
                if (!currentPathMasks.includes(subPath)) {
                    extractedPaths.push({ mainPath: subPath, maskPaths: currentPathMasks, fillColor: color });
                }
            });
        }

    });

    //console.log(extractedPaths);
    return extractedPaths;
};

export default {
    getWidthHeight,
    getBBox,
    getPathPoints,
    computePathCenter,
    isPathHole,
    getNextElementEndIndex,
    cleanPath,
    getColorFromSvgElement,
    rawPathStringToPathElement,
    extractPaths
};