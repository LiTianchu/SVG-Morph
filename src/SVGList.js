import React, { useEffect, useState } from 'react';
import SVGUploader from './SVGUploader';

function SVGList({ onSvgsChange }) {
    const [svgs, setSvgs] = useState([]);
    const [uploaders, setUploaders] = useState([{ id: Date.now() }]);

    const handleSvgUploaded = (svg, index) => {
        setSvgs(prevSvgs => {
            const newSvgs = [...prevSvgs];
            newSvgs[index] = svg;
            return newSvgs;
        });

        console.log("svgs length: " + svgs.length);
        console.log("index: " + index);
        if (svgs.length === index) { // if the last svg is uploaded, add a new uploader
            addUploader();
        }
    }

    const removeUploader = (id, index) => {
        setUploaders(uploaders.filter(uploader => uploader.id !== id));
        setSvgs(prevSvgs => {
            const newSvgs = prevSvgs.filter((_, i) => i !== index);
            return newSvgs;
        });
    }

    const addUploader = () => {
        setUploaders([...uploaders, { id: Date.now() }]);
    }

    const setMorphingSVGs = () => {
        // set the morphing SVGs
        onSvgsChange(svgs.filter(svg => svg !== undefined));
    }

    useEffect(() => {
        // disable remove button if the upload box is not uploaded with anything
        console.log("current svgs: " + svgs);
        uploaders.forEach((uploader, index) => {
            const btn = document.getElementById(uploader.id + "_remove_btn");
            if (btn !== null) {
                btn.disabled = svgs[index] === undefined;
                btn.style.cursor = svgs[index] === undefined ? 'not-allowed' : 'pointer';
                btn.style.color = svgs[index] === undefined ? '#ccc' : 'black';
            }
        });
    }, [svgs, uploaders]);

    return (
        <div>
            <h2 style={{ marginBottom: '5px', fontSize: '20px', color: 'black' }}>SVG Morph Demo</h2>
            <p style={{ marginBottom: '5px', fontSize: '15px', color: 'black' }}>Upload at least 2 SVG files to morph. You can chain multiple SVGs.</p>
            <div
                style={{
                    width: '85%',
                    marginBottom: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                    gap: '10px',
                    margin: 'auto',
                }}
                className="svg-list"
            >
                {uploaders.map((uploader, index) => (
                    <div key={uploader.id} id={uploader.id + "_uploader"} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <SVGUploader onSvgUploaded={(svg) => handleSvgUploaded(svg, index)} index={index} />
                        <button

                            key={uploader.id + "_remove_btn"}
                            id={uploader.id + "_remove_btn"}
                            onClick={() => removeUploader(uploader.id, index)}
                            style={{
                                width: '100px',
                                height: '30px',
                                border: '2px solid #ccc',
                                borderRadius: '4px',
                                margin: '10px',
                                display: 'flex',
                                fontSize: '15px',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: 'pointer',
                                color: 'black',
                                background: 'none',
                                padding: 0,
                                fontFamily: 'inherit',
                            }}
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>
            <button
                id="set-morphing-svgs-btn"
                onClick={setMorphingSVGs}
                style={{
                    width: '350px',
                    height: '40px',
                    border: '2px solid #ccc',
                    borderRadius: '4px',
                    margin: 'auto',
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
            >Start/Update Morphing</button>
        </div>
    );
}

export default SVGList;