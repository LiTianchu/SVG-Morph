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
    return { x: point[0], y: point[1] }
}

const countPointPolygonIntersection = (point, polygonPaths) => {
    console.log("point: " + point);
    console.log("polygon paths: " + polygonPaths);
    point = pointArrToVector(point);
    const ray = point.y; // horizontal ray y = point.y, assuming ray is pointing right
    console.log("ray: " + ray);
    let intersectionCount = 0;
    polygonPaths.forEach(polygon => {
        for (let i = 0; i < polygon.length; i++) {
            const vertex1 = pointArrToVector(polygon[i]);
            const vertex2 = pointArrToVector(polygon[(i + 1) % polygon.length]);
            let [p1, p2] = vertex1.y < vertex2.y ? [vertex1, vertex2] : [vertex2, vertex1]; // keep p1 above p2 (inverted y axis, so vertex1 is above if the y value is lesser)

            if (ray < p1.y || ray >= p2.y) { // ray is above or below the line segment, does not count
                //console.log("ray is above or below the line segment, does not count");
                continue;
            }
            if (point.x > Math.max(p1.x, p2.x)) { // ray is to the right of the line segment, does not count
                //console.log("ray is to the right of the line segment, does not count");
                continue;
            }
            console.log(`found segment within boundary p1: (${p1.x},${p1.y}) p2: (${p2.x},${p2.y})`);

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



const getVector = (point1, point2) => {
    return { x: point2.x - point1.x, y: point2.y - point1.y };
}

export default { getWindingOrder, pointArrToVector, countPointPolygonIntersection, getVector }