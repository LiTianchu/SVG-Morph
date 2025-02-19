import React, { useState } from 'react';
import './App.css';
import SVGMorph from './SVGMorph';
import SVGList from './SVGList';
import MorphSettingPanel from './MorphSettingPanel';

function App() {
  const [svgs, setSvgs] = useState([]);
  const [svgMorphingSettings, setSvgMorphingSettings] = useState({
    duration: 1000,
    easing: 'linear',
  });

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
        <SVGMorph svgs={svgs} morphSetting={svgMorphingSettings} />
        <MorphSettingPanel onSettingChange={setSvgMorphingSettings} />
      </header>
    </div>
  );
}

export default App;
