import React, { useEffect, useState, useRef } from 'react';

function SVGUploader({ onSvgUploaded, index }) {
    const [svgContent, setSvgContent] = useState(null);
    const fileInputRef = useRef(null);
    const svgContainerRef = useRef(null);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (e) => {
                setSvgContent(e.target.result);
                onSvgUploaded(e.target.result);
            };
            reader.readAsText(file);
        } else {
            alert('Please upload a valid SVG file.');
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file && file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (e) => {
                setSvgContent(e.target.result);
                onSvgUploaded(e.target.result);
            };
            reader.readAsText(file);
        } else {
            alert('Please drop a valid SVG file.');
        }
    };

    useEffect(() => {
        if (svgContent && svgContainerRef.current) {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;

            const containerWidth = svgContainerRef.current.clientWidth;
            const containerHeight = svgContainerRef.current.clientHeight;
            const svgWidth = svgElement.width.baseVal.value || parseFloat(svgElement.getAttribute('width')) || svgElement.viewBox.baseVal.width;
            const svgHeight = svgElement.height.baseVal.value || parseFloat(svgElement.getAttribute('height')) || svgElement.viewBox.baseVal.height;

            const scaleX = containerWidth / svgWidth;
            const scaleY = containerHeight / svgHeight;
            const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');
            svgElement.style.transform = `scale(${scale * 0.8})`;
            svgElement.style.transformOrigin = 'center';

            // set svg to white color
            svgElement.style.fill = 'black';

            setSvgContent(svgElement.outerHTML);
        }
    }, [svgContent]);

    return (
        <div className ="svg-uploader" id={"svg-uploader" + index}>
            <button
                style={{
                    width: '300px',
                    height: '40px',
                    border: '2px solid #ccc',
                    borderRadius: '4px',
                    margin: '10px',
                    display: 'flex',
                    fontSize: '24px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: 'black',
                    background: 'none',  // Remove default button background
                    padding: 0,  // Remove default button padding
                    fontFamily: 'inherit',  // Use the same font as the rest of your app
                }}
                onClick={() => fileInputRef.current.click()}
            >
                <p>Click to Upload SVG</p>
            </button>
            <input
                type="file"
                accept=".svg"
                onChange={handleFileUpload}
                ref={fileInputRef}
                style={{ display: 'none' }}
            />
            <div
                ref={svgContainerRef}
                style={{
                    width: '300px',
                    height: '200px',
                    margin: '10px',
                    border: '2px dashed #ccc',
                    borderRadius: '4px',
                    display: 'flex',
                    fontSize: '24px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: "black"
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {svgContent ? (
                    <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ width: '100%', height: '100%' }} />
                ) : (
                    <p>Or Drag and Drop Here</p>
                )}
            </div>
        </div>
    );
}

export default SVGUploader;