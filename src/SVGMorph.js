import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { interpolate } from 'flubber';

function SVGMorph({ svg1, svg2 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svg1 || !svg2) return; // exit if no svg1 or svg2
    d3.select(svgRef.current).selectAll('*').remove();
    const extractPaths = (svgString) => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const pathElements = Array.from(svgDoc.querySelectorAll('path')).map(path => path.getAttribute('d'));
      return pathElements;
    };

    const svg1PathList = extractPaths(svg1);

    if (svg1PathList.length === 0) {
      console.error('No paths found in svg1');
      return;
    }

    const svg2PathList = extractPaths(svg2);

    if (svg2PathList.length === 0) {
      console.error('No paths found in svg2');
      return;
    }

    if (svg1PathList.length !== svg2PathList.length) {
      console.error('Number of paths in svg1 and svg2 do not match');
      return;
    }

    for (let i = 0; i < svg1PathList.length; i++) {
      const svg1Path = svg1PathList[i];
      const svg2Path = svg2PathList[i];

      console.log(svg1Path, svg2Path);

      const interpolatorTo2 = interpolate(svg1Path, svg2Path, { maxSegmentLength: 0.1 });
      const interpolatorTo1 = interpolate(svg2Path, svg1Path, { maxSegmentLength: 0.1 });

      const svg = d3.select(svgRef.current);
      //const path = svg.select('path');
      // add path to svg
      svg.append('path')
        .attr('d', svg1Path)
        .attr('fill', 'white')
        .attr('id', `path-${i}`);

      const path = svg.select(`#path-${i}`);

      function animateTo2() {
        d3.select(path.node())
          .transition()
          .duration(2000)
          .attrTween('d', () => interpolatorTo2)
          .on('end', animateTo1);
      }

      function animateTo1() {
        d3.select(path.node())
          .transition()
          .duration(2000)
          .attrTween('d', () => interpolatorTo1)
          .on('end', animateTo2);
      }

      animateTo2();  // Start the animation
    }



    // Cleanup function
    return () => {
      d3.select(svgRef.current).selectAll('*').interrupt();  // Stop any ongoing transitions
    };
  }, [svg1, svg2]);

  return (

    <svg ref={svgRef} width="1000" height="1000" viewBox="0 0 100 100">
      {/* <path
        fill="white"
        d={svg1 ? svg1 : "M0,0"}
      /> */}
    </svg>

  );
}

export default SVGMorph;