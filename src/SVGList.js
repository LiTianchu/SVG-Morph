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
            addUploader();
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '10px', gridAutoFlow: 'column'}} className="svg-list">
            {
                uploaders.map((uploader, index) => (
                    <div key={uploader.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <SVGUploader onSvgUploaded={(svg) => handleSvgUploaded(svg, index)} index={index} />
                        <button onClick={() => removeUploader(uploader.id)} style={{ marginTop: '10px' }}>Remove</button>
                    </div>
                ))
            }
        
        </div>
    );
}

export default SVGList;