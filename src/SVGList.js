import React, { useState } from 'react';
import SVGUploader from './SVGUploader';

function SVGList({ onSvgsChange }) {
    const [svgs, setSvgs] = useState([]);
    const [uploaders, setUploaders] = useState([{ id: 0 }]);

    const handleSvgUploaded = (svg, index) => {
        setSvgs(prevSvgs => {
            const newSvgs = [...prevSvgs];
            newSvgs[index] = svg;
            onSvgsChange(newSvgs);
            return newSvgs;
        });
    }

    const removeUploader = (id) => {
        setUploaders(uploaders.filter(uploader => uploader.id !== id));
        setSvgs(prevSvgs => {
            const newSvgs = prevSvgs.filter((_, i) => i !== id);
            onSvgsChange(newSvgs);
            return newSvgs;
        });
    }

    const addUploader = () => {
        setUploaders([...uploaders, { id: uploaders.length }]);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="svg-list">
            {
                uploaders.map((uploader, index) => (
                    <div key={uploader.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                        <SVGUploader onSvgUploaded={(svg) => handleSvgUploaded(svg, index)} index={index} />
                        <button onClick={() => removeUploader(uploader.id)} style={{ marginLeft: '10px' }}>Remove</button>
                    </div>
                ))
            }
            <button onClick={addUploader} style={{ marginTop: '20px' }}>Add SVG +</button>
        </div>
    );
}

export default SVGList;