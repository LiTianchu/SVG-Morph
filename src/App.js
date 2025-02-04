import React, { useState } from 'react';
import './App.css';
import SVGMorph from './SVGMorph';
import SVGList from './SVGList';

function App() {
  // const [svg1,setSvg1] = useState(null);
  // const [svg2,setSvg2] = useState(null);
  // const [svg3,setSvg3] = useState(null);
  const [svgs, setSvgs] = useState([]);

  const handleSvgUpload = (index, svg) => {
    setSvgs(prevSvgs => {
      const newSvgs = [...prevSvgs];
      newSvgs[index] = svg;
      return newSvgs;
    });
  }

  return (
    <div className="App">
      <header className="App-header">
        <SVGList onSvgsChange={setSvgs} />
        {/* <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '300px' }}>
          <SVGUploader onSvgUploaded={(svg) => handleSvgUpload(0, svg)} />
          <SVGUploader onSvgUploaded={(svg) => handleSvgUpload(1, svg)} />
          <SVGUploader onSvgUploaded={(svg) => handleSvgUpload(2, svg)} />
        </div> */}
        <SVGMorph svgs={svgs} />
      </header>
    </div>
  );
}

export default App;
