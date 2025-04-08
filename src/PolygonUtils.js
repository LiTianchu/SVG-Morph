const getWindingOrder = (points) => {
    const sum = computePolygonAreaSigned(points);

    // note: in normal cartesian coordinates positive signed area = CCW, negative signed area = CW
    // but svg uses inverted y axis, so the result is inverted
    return sum > 0 ? "CW" : "CCW";
}

const pointArrToVector = (point) => {
    return { x: point[0], y: point[1] }
}

const countPointPolygonIntersection = (point, polygonPaths) => {
    point = pointArrToVector(point);
    const ray = point.y; // horizontal ray y = point.y, assuming ray is pointing right
    let intersectionCount = 0;
    polygonPaths.forEach(polygon => {
        for (let i = 0; i < polygon.length; i++) {
            const vertex1 = pointArrToVector(polygon[i]);
            const vertex2 = pointArrToVector(polygon[(i + 1) % polygon.length]);
            let [p1, p2] = vertex1.y < vertex2.y ? [vertex1, vertex2] : [vertex2, vertex1]; // keep p1 above p2 (inverted y axis, so vertex1 is above if the y value is lesser)

            if (ray < p1.y || ray >= p2.y) { // ray is above or below the line segment, does not count
                continue;
            }
            if (point.x > Math.max(p1.x, p2.x)) { // ray is to the right of the line segment, does not count
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

const computePolygonAreaSigned = (points) => {
    if (!points || points.length < 3) {
        return 0;
    }

    let sum = 0;
    // calculate signed area using shoelace theorem
    for (let i = 0; i < points.length; i++) {
        let [x1, y1] = points[i];
        let [x2, y2] = points[(i + 1) % points.length]; // loop back at the end
        sum += x1 * y2 - x2 * y1;
    }
    return sum;
}

const getCentroid = (points) => {
    if (!points || points.length < 3) {
        return { x: 0, y: 0 };
    }
    let cx = 0;
    let cy = 0;
    const signedA = computePolygonAreaSigned(points) / 2;
    points.forEach((point, i) => {
        const [x1, y1] = point;
        const [x2, y2] = points[(i + 1) % points.length]; // loop back at the end
        cx += (x1 + x2) * (x1 * y2 - x2 * y1);
        cy += (y1 + y2) * (x1 * y2 - x2 * y1);
    });
    cx /= (6 * signedA);
    cy /= (6 * signedA);
    return { x: cx, y: cy };
}

const computePolygonArea = (points) => {
    if (!points || points.length < 3) {
        return 0;
    }

    return Math.abs(computePolygonAreaSigned(points)) / 2; // A = 1/2 * |signed sum|
}


const getVector = (point1, point2) => {
    return { x: point2.x - point1.x, y: point2.y - point1.y };
}

const getEuclideanDistance = (point1, point2) => {
    const vector = getVector(point1, point2);
    return Math.sqrt(vector.x ** 2 + vector.y ** 2);
}

export default { getWindingOrder, getCentroid, pointArrToVector, countPointPolygonIntersection, computePolygonAreaSigned, computePolygonArea, getVector,getEuclideanDistance }