import PathConverter from "./PathConverter";
import PolygonUtils from "./PolygonUtils";

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
    return points;
}

const isPathHole = (selectedPoint, pathPoints, otherPathPoints, outerContourPoints, fillrule) => {
    const outerContourWindingOrder = PolygonUtils.getWindingOrder(outerContourPoints);

    const numOfIntersections = PolygonUtils.countPointPolygonIntersection(selectedPoint, otherPathPoints);

    if (fillrule === 'evenodd') {
        // use point in polygon algorithm to determine if the path is a hole
        // if the point is inside an odd number of polygons except itself, it is a hole
        return numOfIntersections % 2 === 1;
    } else { // non-zero fill rule
        const windingOrder = PolygonUtils.getWindingOrder(pathPoints);
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

const isPathStringValid = (path) => {
    if (!path || typeof path !== 'string' || path === "") {
        return false;
    }

    // check for disallowed values
    if (/NaN|Infinity|undefined|null/i.test(path)) {
        return false;
    }

    // path must start with "M" or "m"
    if (path[0] !== 'M' && path[0] !== 'm') {
        return false;
    }
    return true;
}

const cleanPath = (path) => {
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
        if(subPath.includes("NaN")){
            return;
        }
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
        } else {
            absoluteCoordPath += "M" + subPath;
        }
    });

    return absoluteCoordPath;
}

const getColorFromSvgElement = (pathElement) => {
    let fillColor = pathElement.getAttribute('fill');
    if (fillColor == null) {
        // try find style attribute
        const style = pathElement.getAttribute('style');
        if (style != null) {
            const styleAttrs = style.split(';');
            // get fill: value
            styleAttrs.forEach((attr, i) => {

                const [key, value] = attr.split(':').map(s => s.trim());

                if (!key || !value) { // skip empty values
                    return;
                }

                if (key === 'fill') {
                    console.log("fill color: " + value);
                    fillColor = value;
                }
            });
        }

    }
    return fillColor;
}

const getStrokeDataFromSvgElement = (pathElement) => {
    const style = pathElement.getAttribute('style');
    const strokeColorAttr = pathElement.getAttribute('stroke');
    const strokeWidthAttr = pathElement.getAttribute('stroke-width');
    const strokeOpacityAttr = pathElement.getAttribute('stroke-opacity');

    let strokeColor = strokeColorAttr;
    let strokeWidth = strokeWidthAttr;
    let strokeOpacity = strokeOpacityAttr;
    if (strokeWidthAttr != null) {
        strokeWidth = parseFloat(strokeWidth);
    }
    if (strokeOpacityAttr != null) {
        strokeOpacity = strokeOpacityAttr.endsWith("%") ? parseFloat(strokeOpacityAttr) / 100 : parseFloat(strokeOpacityAttr);
    }

    let data = { strokeColor: strokeColor, strokeWidth: strokeWidth, strokeOpacity: strokeOpacity };

    if (style == null) {
        return data;
    }

    const styleAttrs = style.split(';');

    styleAttrs.forEach((attr, i) => {
        const [key, value] = attr.split(':').map(s => s.trim());
        if (!key || !value) { // skip empty values
            return;
        }

        if (strokeColorAttr == null && key === 'stroke') {
            data.strokeColor = value;
        }
        if (strokeWidthAttr == null && key === 'stroke-width') {
            data.strokeWidth = parseFloat(value);
        }
        if (strokeOpacityAttr == null && key === 'stroke-opacity') {
            data.strokeOpacity = value.endsWith("%") ? parseFloat(value) / 100 : parseFloat(value);
        }
    })

    return data;
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
    const parentStrokeData = getStrokeDataFromSvgElement(svgDoc.documentElement);
    let pathList = Array.from(svgDoc.querySelectorAll(':scope > path, :scope > rect, :scope > circle, :scope > ellipse, :scope > line, :scope > polyline, :scope > polygon')); // selects only path in the direct children
    let extractedPaths = [];

    //convert non path elements to path elements
    pathList.forEach((pathElement, i) => {
        let currentPathMasks = [];
        let color = getColorFromSvgElement(pathElement);
        let strokeData = getStrokeDataFromSvgElement(pathElement);
        if (color == null) {
            color = parentFillColor;
        }

        let isStrokeColorDefined = true;

        if (strokeData.strokeColor == null) {
            strokeData.strokeColor = parentStrokeData.strokeColor;

            if (strokeData.strokeColor == null) {
                isStrokeColorDefined = false;
                strokeData.strokeColor = "black";
            }
        }
        if (strokeData.strokeWidth == null) {
            strokeData.strokeWidth = parentStrokeData.strokeWidth;
            if (strokeData.strokeWidth == null) {
                strokeData.strokeWidth = isStrokeColorDefined ? 1: 0; // default stroke width is 1 if stroke color is defined
            }
        }
        if (strokeData.strokeOpacity == null) {
            strokeData.strokeOpacity = parentStrokeData.strokeOpacity;
            if (strokeData.strokeOpacity == null) {
                strokeData.strokeOpacity = isStrokeColorDefined ? 1 : 0; // default stroke opacity is 1 if stroke color is defined
            }
        }
        const maskAttr = pathElement.getAttribute('mask');

        if (pathElement.tagName !== 'path') {
            let convertedPathString = null;
            switch (pathElement.tagName) {
                case 'rect':
                    convertedPathString = PathConverter.rectToPath(pathElement);
                    break;
                case 'circle':
                    convertedPathString = PathConverter.circleToPath(pathElement);
                    break;
                case 'ellipse':
                    convertedPathString = PathConverter.ellipseToPath(pathElement);
                    break;
                case 'line':
                    convertedPathString = PathConverter.lineToPath(pathElement);
                    break;
                case 'polyline':
                    convertedPathString = PathConverter.polylineToPath(pathElement);
                    break;
                case 'polygon':
                    convertedPathString = PathConverter.polygonToPath(pathElement);
                    break;
                default: console.log("unsupported path element tag: " + pathElement.tagName);
            }
            pathElement = rawPathStringToPathElement(convertedPathString);
        }

        const path = pathElement.getAttribute('d')

        // check if path has a mask
        const maskId = maskAttr != null ? maskAttr.slice(5, -1) : null;

        if (maskId != null) {
            const maskElement = svgDoc.getElementById(maskId);
            const maskPathElements = Array.from(maskElement.querySelectorAll(':scope > path, :scope > rect, :scope > circle, :scope > ellipse, :scope > line, :scope > polyline, :scope > polygon'));
            // handle mask paths that are not path elements
            maskPathElements.forEach((maskPathElement, i) => {
                const maskColor = getColorFromSvgElement(maskPathElement);
                console.log("mask color: " + maskColor);
                if (maskColor == null || maskColor === "white") { // skip white mask paths (bg) or paths with no fill
                    console.log("skipping mask path with color: " + maskColor);
                    return;
                }

                if (maskPathElement.tagName !== 'path') {
                    let convertedPathString = null;
                    switch (maskPathElement.tagName) {
                        case 'rect':
                            convertedPathString = PathConverter.rectToPath(maskPathElement);
                            break;
                        case 'circle':
                            convertedPathString = PathConverter.circleToPath(maskPathElement);
                            break;
                        case 'ellipse':
                            convertedPathString = PathConverter.ellipseToPath(maskPathElement);
                            break;
                        case 'line':
                            convertedPathString = PathConverter.lineToPath(maskPathElement);
                            break;
                        case 'polyline':
                            convertedPathString = PathConverter.polylineToPath(maskPathElement);
                            break;
                        case 'polygon':
                            convertedPathString = PathConverter.polygonToPath(maskPathElement);
                            break;
                        default: console.log("unsupported mask path element tag: " + maskPathElement.tagName);
                    }
                    maskPathElement = rawPathStringToPathElement(convertedPathString);
                }

                const maskPath = maskPathElement.getAttribute('d');
                if(isPathStringValid(maskPath)){
                    currentPathMasks.push(maskPath);
                }
            });
        }

        const convertedAbsolutePath = cleanPath(path);
        if(!isPathStringValid(convertedAbsolutePath)){
            return;
        }

        // if path contains subpaths, split them into separate paths
        if (convertedAbsolutePath.includes('M')) {
            const subPaths = convertedAbsolutePath.split(/(?=M)/).filter(Boolean); // split at each 'M' while keeping it

            // check if the path contains holes as subpaths
            const fillRule = pathElement.getAttribute('fill-rule');
            let outerContour = null;
            let outerContourPoints = null;
            let subPathData = [];
            subPaths.forEach((subPath, i) => {
                console.log("getting path points from sub path: " + subPath);
                let pathPoints = getPathPoints(subPath);
                let selectedPoint = pathPoints[0];
                if (selectedPoint == null || selectedPoint == undefined) {
                    const commandIndex = getNextElementEndIndex(subPath, 0); // M
                    const xCoordEndIndex = getNextElementEndIndex(subPath, commandIndex);
                    const yCoordEndIndex = getNextElementEndIndex(subPath, xCoordEndIndex);

                    selectedPoint = [parseFloat(subPath.slice(commandIndex, xCoordEndIndex)),
                    parseFloat(subPath.slice(xCoordEndIndex, yCoordEndIndex))];
                    subPathData.push({ points: pathPoints, subPath: subPath, firstPoint: selectedPoint });
                    return;
                } else {
                    subPathData.push({ points: pathPoints, subPath: subPath, firstPoint: selectedPoint });
                }

                const filteredPathData = subPathData.filter(p => p.subPath != subPath);

                const numOfIntersections = PolygonUtils.countPointPolygonIntersection(selectedPoint, filteredPathData.map(p => p.points));
                if (numOfIntersections % 2 === 0) { // if the point is outside an even number of polygon line segments, it is the outer contour
                    outerContour = subPath;
                    outerContourPoints = subPathData[i].points;
                    return;
                }
            });

            subPaths.forEach((subPath, i) => {
                // if the subpath is a hole, add it to the mask paths
                const filteredPathData = subPathData.filter(p => p.subPath != subPath);
                if (isPathHole(subPathData[i].firstPoint, subPathData[i].points, filteredPathData.map(p => p.points), outerContourPoints, fillRule)) {
                    currentPathMasks.push(subPath);
                }
            });

            let maskPathPoints = [];
            currentPathMasks.forEach((maskPath, i) => {
                const maskPathData = subPathData.find(p => p.subPath === maskPath);
                if (maskPathData == null || maskPathData == undefined) { // handle cases where the mask if pre-defined
                    console.log("getting mask path points from pre-defined mask path");
                    maskPathPoints.push(getPathPoints(maskPath));
                } else {
                    maskPathPoints.push(maskPathData.points);
                }
            });

            subPaths.forEach(subPath => {
                if (!currentPathMasks.includes(subPath)) { // if tis subpath is the main path
                    const mainPathPoints = subPathData.find(p => p.subPath === subPath).points;
                    console.log(strokeData);
                    extractedPaths.push({ mainPath: subPath, mainPathPoints: mainPathPoints, maskPaths: currentPathMasks, maskPathPoints: maskPathPoints, fillColor: color, strokeData: strokeData });
                }
            });
        }

    });

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