import React, { useState } from 'react';
import './App.css';
import SVGMorph from './SVGMorph';
import SVGUploader from './SVGUploader';

function App() {
  const [svg1,setSvg1] = useState(null);
  const [svg2,setSvg2] = useState(null);

  return (
    <div className="App">
      <header className="App-header">
        <div style={{display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '300px'}}>
        <SVGUploader onSvgUploaded={setSvg1}/>
        <SVGUploader onSvgUploaded={setSvg2}/>
        </div>
        <SVGMorph svg1={svg1} svg2={svg2}/>
      </header>
    </div>
  );
}

export default App;
