import React, { useState } from 'react';
import './App.css';
import SVGMorph from './SVGMorph';
import SVGList from './SVGList';
import MorphSettingPanel from './MorphSettingPanel';
import ExportSettingPanel from './ExportSettingPanel';

function App() {
  const [svgs, setSvgs] = useState([]);
  const [svgMorphingSettings, setSvgMorphingSettings] = useState({
    duration: 1000,
    quality: 10,
    easing: 'linear',
    oneToMany: 'duplicate',
    matching: 'default'
  });

  const [exportSettings, setExportSettings] = useState({
    framerate: 24,
    resolution: 1024,
    fileFormat: "MP4",
    filename: "morphing"
  });

  const [loadingInfoList, setLoadingInfoList] = useState([{
    text: 'Please upload at least 2 SVGs to start morphing.'
  }])

  const [isMorphing, setIsMorphing] = useState(false);

  const handleLoadingStateChange = (isStartingNewMorph, isMorphing, loadingInfo) => {
    setIsMorphing(isMorphing);

    setLoadingInfoList(prevLoadingInfo => {
      // if loadingInfo.text is empty, do not add to loadingInfoList
      let newLoadingInfo = [...prevLoadingInfo];
      if (loadingInfo.text !== '') {
        newLoadingInfo.push(loadingInfo);
      }

      if (isStartingNewMorph) {
        return [{
          text: 'Please upload at least 2 SVGs to start morphing.'
        }];
      } else {
        return newLoadingInfo.slice(-10); //only keep top 10 latest message
      }

    });
  }

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'flex', flexDirection: 'column',justifyContent:'space-evenly', alignItems: 'center', width: '100%',position:'relative',height:'100%' }}>
          <div style={{ height: '30%' ,width:'100%',padding:'10px'}}>
            <SVGList onSvgsChange={setSvgs} />
          </div>
          <div id="morphing-preview" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', aspectRatio:'1/1', width:'auto',height: "30%",minWidth:'100px',padding:'10px'}}>
            <SVGMorph svgs={svgs} morphSetting={svgMorphingSettings} exportSetting={exportSettings} onLoadingStateChange={handleLoadingStateChange} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', width: '70%', height:'30%',padding: '10px' }}>
            <MorphSettingPanel onSettingChange={setSvgMorphingSettings} />
            <ExportSettingPanel onExportSettingChange={setExportSettings} />
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
