import React, { useState } from 'react';

function ExportSettingPanel({ onExportSettingChange }) {
    const [framerate, setFramerate] = useState(24);
    const [resolution, setResolution] = useState(1024);
    const [fileFormat, setFileFormat] = useState("MP4");
    const [filename, setFilename] = useState("morphing");

    const handleFramerateSettingChange = (newFramerate) => {
        setFramerate(newFramerate);
        onExportSettingChange({ resolution: resolution, framerate: newFramerate, fileFormat: fileFormat, filename: filename });
    }
    
    const handleResolutionSettingChange = (newResolution) => {
        setResolution(newResolution);
        onExportSettingChange({ resolution: newResolution, framerate: framerate, fileFormat: fileFormat, filename: filename });
    }


    const handleFileFormatSettingChange = (newFileFormat) => {
        setFileFormat(newFileFormat);
        onExportSettingChange({ resolution: resolution, framerate: framerate, fileFormat: newFileFormat, filename: filename });
    }

    const handleFilenameSettingChange = (newFilename) => {
        setFilename(newFilename);
        onExportSettingChange({ resolution: resolution, framerate: framerate, fileFormat: fileFormat, filename: newFilename });
    }

    return (
        <div style={{ display: 'flex', alignItems:'start',alignContent:'space-between', flexDirection:'column',width: '40%'}}>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}>Export Framerate</label>
                <input type="range" min="5" max="60" step="1" id="framerate-slider" value={framerate} onChange={(e) => handleFramerateSettingChange(e.target.value)}></input>
                <span style={{ marginLeft: '10px', fontSize: '0.45em', color: 'black' }}>{framerate}fps</span>
            </div>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}>Export Resolution</label>
                <input type="range" min="256" max="4096" step="256" id="resolution-slider" value={resolution} onChange={(e) => handleResolutionSettingChange(e.target.value)}></input>
                <span style={{ marginLeft: '10px', fontSize: '0.45em', color: 'black' }}>{resolution} X {resolution}</span>
            </div>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}
                >Export Format</label>
                <select id="fileFormat-select" value={fileFormat} onChange={(e) => handleFileFormatSettingChange(e.target.value)}>
                    <option value="MP4">MP4</option>
                    <option value="Separated MP4s">Separated MP4s</option>
                    <option value="PNGs">PNGs</option>
                </select>
            </div>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}>Export Filename</label>
                <input type="text" id="filename-input" value={filename} onChange={(e) => handleFilenameSettingChange(e.target.value)}></input>
            </div>
        </div>
    );
}

export default ExportSettingPanel;