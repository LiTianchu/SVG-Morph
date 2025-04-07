import React, { useState } from 'react';
import './App.css';
import SVGMorph from './SVGMorph';
import SVGList from './SVGList';
import MorphSettingPanel from './MorphSettingPanel';
import LoadingInfoView from './LoadingInfoView';
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
    fileFormat: "MP4"
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
        <SVGList onSvgsChange={setSvgs} />
        <div id="morphing-preview" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', width: "300px", height: "300px" }}>
          <SVGMorph svgs={svgs} morphSetting={svgMorphingSettings} exportSetting={exportSettings} onLoadingStateChange={handleLoadingStateChange} />
          {/* <LoadingInfoView loadingInfoList={loadingInfoList} isMorphing={isMorphing} /> */}
        </div>
        <div style={{ display: 'flex' ,justifyContent: 'space-around', width: '70%', padding: '10px'}}>
          <MorphSettingPanel onSettingChange={setSvgMorphingSettings} />
          <ExportSettingPanel onExportSettingChange={setExportSettings} />
        </div>
      </header>
    </div>
  );
}

export default App;
