const rectToPath = (rect) => {
    let x = parseFloat(rect.getAttribute("x")) || 0;
    let y = parseFloat(rect.getAttribute("y")) || 0;
    let w = parseFloat(rect.getAttribute("width"));
    let h = parseFloat(rect.getAttribute("height"));
    let rx = parseFloat(rect.getAttribute("rx")) || 0; // rounded corners
    let ry = parseFloat(rect.getAttribute("ry")) || 0;

    if (rx > 0 || ry > 0) {
        return `M ${x + rx},${y} 
            h ${w - 2 * rx} 
            a ${rx},${ry} 0 0 1 ${rx},${ry} 
            v ${h - 2 * ry} 
            a ${rx},${ry} 0 0 1 -${rx},${ry} 
            h -${w - 2 * rx} 
            a ${rx},${ry} 0 0 1 -${rx},-${ry} 
            v -${h - 2 * ry} 
            a ${rx},${ry} 0 0 1 ${rx},-${ry} 
            Z`;
    }
    return `M ${x},${y} h ${w} v ${h} h -${w} Z`;
}

const circleToPath = (circle) => {
    let cx = parseFloat(circle.getAttribute("cx"));
    let cy = parseFloat(circle.getAttribute("cy"));
    let r = parseFloat(circle.getAttribute("r"));

    return `M ${cx - r},${cy} 
          a ${r},${r} 0 1,0 ${2 * r},0 
          a ${r},${r} 0 1,0 -${2 * r},0 Z`;
}

const ellipseToPath = (ellipse) => {
    let cx = parseFloat(ellipse.getAttribute("cx"));
    let cy = parseFloat(ellipse.getAttribute("cy"));
    let rx = parseFloat(ellipse.getAttribute("rx"));
    let ry = parseFloat(ellipse.getAttribute("ry"));

    return `M ${cx - rx},${cy} 
          a ${rx},${ry} 0 1,0 ${2 * rx},0 
          a ${rx},${ry} 0 1,0 -${2 * rx},0 Z`;
}

const lineToPath = (line) => {
    let x1 = parseFloat(line.getAttribute("x1"));
    let y1 = parseFloat(line.getAttribute("y1"));
    let x2 = parseFloat(line.getAttribute("x2"));
    let y2 = parseFloat(line.getAttribute("y2"));

    return `M ${x1},${y1} L ${x2},${y2}`;
}

const polylineToPath = (polyline) => {
    let points = polyline.getAttribute("points").trim();
    let commands = points.split(" ").map((point, index) => {
        let [x, y] = point.split(",").map(Number);
        return (index === 0 ? `M ${x},${y}` : `L ${x},${y}`);
    });

    return commands.join(" ");
}

const polygonToPath = (polygon) => {
    let pathData = polylineToPath(polygon); 
    return pathData + " Z"; 
}

export default { rectToPath, circleToPath, ellipseToPath, lineToPath, polylineToPath, polygonToPath };