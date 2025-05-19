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
                uploadSVG(e.target.result);
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
                uploadSVG(e.target.result);
            };
            reader.readAsText(file);
        } else {
            alert('Please drop a valid SVG file.');
        }
    };

    const uploadSVG = (svgString) => {
        // display the uploaded SVG in the container
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');

        // set svg to white color
        svgElement.style.fill = 'black';

        setSvgContent(svgElement.outerHTML);

        // callback to send the svg string data to the parent component
        onSvgUploaded(svgString);
    }

    return (
        <div className="svg-uploader" id={"svg-uploader" + index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' ,width:'200px'}}>
            <button
                style={{
                    width: '100%',
                    height: '40px',
                    border: '2px solid #ccc',
                    borderRadius: '4px',
                    margin: '10px',
                    display: 'flex',
                    fontSize: '18px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: 'black',
                    background: 'none', 
                    padding: 0, 
                    fontFamily: 'inherit', 
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
                    aspectRatio: '1 / 1',
                    width: '100%',
                    margin: '10px',
                    border: '2px dashed #ccc',
                    borderRadius: '4px',
                    display: 'flex',
                    fontSize: '18px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: "black",
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {svgContent ? (
                    <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ width:'100%', height: '100%',padding:'10%' }} />
                ) : (
                    <p>Or Drag Here</p>
                )}
            </div>
        </div>
    );
}

export default SVGUploader;