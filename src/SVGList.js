import React, { useEffect, useState } from 'react';
import SVGUploader from './SVGUploader';

function SVGList({ onSvgsChange }) {
    const [svgs, setSvgs] = useState([]);
    const [uploaders, setUploaders] = useState([{ id: Date.now() }]);

    const handleSvgUploaded = (svg, index) => {
        setSvgs(prevSvgs => {
            const newSvgs = [...prevSvgs];
            newSvgs[index] = svg;
            onSvgsChange(newSvgs);
            return newSvgs;
        });
        
        console.log("svgs length: " + svgs.length);
        console.log("index: " + index);
        if(svgs.length === index){ // if the last svg is uploaded, add a new uploader
            addUploader();
        }
    }

    const removeUploader = (id, index) => {
        setUploaders(uploaders.filter(uploader => uploader.id !== id));
        setSvgs(prevSvgs => {
            const newSvgs = prevSvgs.filter((_, i) => i !== index);
            onSvgsChange(newSvgs);
            return newSvgs;
        });
    }

    const addUploader = () => {
        setUploaders([...uploaders, { id: Date.now() }]);
    }

    useEffect(() => {
        // disable remove button if the upload box is not uploaded with anything
        console.log("current svgs: " + svgs);
        uploaders.forEach((uploader, index) => {
            const btn = document.getElementById(uploader.id + "_remove_btn");
            if (btn !== null) {
                btn.disabled = svgs[index] === undefined;
            }
        });
    }, [svgs, uploaders]);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '10px', gridAutoFlow: 'column' }} className="svg-list">
            {
                uploaders.map((uploader, index) => (
                    <div key={uploader.id} id={uploader.id + "_uploader"} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <SVGUploader onSvgUploaded={(svg) => handleSvgUploaded(svg, index)} index={index} />
                        <button key={uploader.id + "_remove_btn"} id={uploader.id + "_remove_btn"} onClick={() => removeUploader(uploader.id, index)} style={{ marginTop: '10px' }}>Remove</button>
                    </div>
                ))
            }
        </div>
    );
}

export default SVGList;