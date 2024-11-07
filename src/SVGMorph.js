import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { interpolate } from 'flubber';

function SVGMorph({ svg1, svg2 }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const pathsRef = useRef([]); // Store path elements to access them from button click
  const interpolatorsRef = useRef([]);

  useEffect(() => {
    if (!svg1 || !svg2) return;

    d3.select(svgRef.current).selectAll('*').remove();
    pathsRef.current = []; // Clear previous paths

    const extractPaths = (svgString) => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      return Array.from(svgDoc.querySelectorAll('path')).map(path => path.getAttribute('d'));
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

    // Create and animate paths
    const svg = d3.select(svgRef.current);
    svg1PathList.forEach((svg1Path, i) => {
      const svg2Path = svg2PathList[i];
      const interpolatorTo2 = interpolate(svg1Path, svg2Path, { maxSegmentLength: 0.1 });
      const interpolatorTo1 = interpolate(svg2Path, svg1Path, { maxSegmentLength: 0.1 });

      const path = svg.append('path')
        .attr('d', svg1Path)
        .attr('fill', 'white')
        .attr('id', `path-${i}`);
      
      pathsRef.current.push({ path, interpolatorTo2, interpolatorTo1 });

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

      animateTo2(); // Start the animation initially
    });

    return () => {
      d3.select(svgRef.current).selectAll('*').interrupt();
    };
  }, [svg1, svg2]);

  // Button click handler to start animation on all paths
  function handleFrameExport() {
    const numFrames = 5;
    const context = canvasRef.current.getContext('2d');
    const svg = d3.select(svgRef.current);

    // Create frames at intervals from 0 to 1
    const frames = Array.from({ length: numFrames }, (_, i) => i / (numFrames - 1)); // frames = [0, 0.25, 0.5, 0.75, 1];
    frames.forEach((t, frameIndex) => {
      svg.selectAll('path').each(function(d, i) {
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
      <canvas ref={canvasRef} width="500" height="500" style={{display:'none'}}></canvas>
    </div>
  );
}

export default SVGMorph;
