import React, { useState } from 'react';

function MorphSettingPanel({ onSettingChange }) {
    const [duration, setDuration] = useState(1000);
    const [easing, setEasing] = useState('linear');
    const [oneToMany, setOneToMany] = useState('duplicate');
    const [quality, setQuality] = useState(10);
    const [matching, setMatching] = useState('default');

    const handleDurationSettingChange = (newDuration) => {
        setDuration(newDuration);
        onSettingChange({ duration: newDuration, quality: quality, easing: easing, oneToMany: oneToMany, matching: matching });
    }

    const handleEasingSettingChange = (newEasing) => {
        if (newEasing !== easing) {
            setEasing(newEasing);
            onSettingChange({ duration: duration, quality: quality, easing: newEasing, oneToMany: oneToMany, matching: matching });
        }
    }

    const handleOneToManySettingChange = (newOneToMany) => {
        if (newOneToMany !== oneToMany) {
            setOneToMany(newOneToMany);
            onSettingChange({ duration: duration, quality: quality, easing: easing, oneToMany: newOneToMany, matching: matching });
        }
    }

    const handleMatchingSettingChange = (newMatching) => {
        if (newMatching !== matching) {
            setMatching(newMatching);
            onSettingChange({ duration: duration, quality: quality, easing: easing, oneToMany: oneToMany, matching: newMatching });
        }
    }

    const handleQualitySettingChange = (newQuality) => {
        const qualityInt = parseInt(newQuality);
        if (qualityInt != quality) {
            setQuality(qualityInt);
            onSettingChange({ duration: duration, quality: qualityInt, easing: easing, oneToMany: oneToMany, matching: matching });
        }
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
                }}>Morph Duration</label>
                <input type="range" min="100" max="5000" step="100" id="duration-slider" value={duration} onChange={(e) => handleDurationSettingChange(e.target.value)}></input>
                <span style={{ marginLeft: '10px', fontSize: '0.45em', color: 'black' }}>{duration}ms</span>
            </div>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}>Animation Quality</label>
                 <select id="quality-select" value={quality} onChange={(e) => handleQualitySettingChange(e.target.value)}>
                    <option value="1">Lowest</option>
                    <option value="5">Low</option>
                    <option value="10">Mid</option>
                    <option value="20">High</option>
                    <option value="30">Highest</option>
                </select>
            </div>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}
                >Easing Effect</label>
                <select id="easing-select" value={easing} onChange={(e) => handleEasingSettingChange(e.target.value)}>
                    <option value="linear">Linear</option>
                    <option value="quad-in">Quad In</option>
                    <option value="quad-out">Quad Out</option>
                    <option value="quad-in-out">Quad In-Out</option>
                    <option value="cubic-in">Cubic In</option>
                    <option value="cubic-out">Cubic Out</option>
                    <option value="cubic-in-out">Cubic In-Out</option>
                    <option value="sin-in">Sine In</option>
                    <option value="sin-out">Sine Out</option>
                    <option value="sin-in-out">Sine In-Out</option>
                    <option value="exp-in">Exponential In</option>
                    <option value="exp-out">Exponential Out</option>
                    <option value="exp-in-out">Exponential In-Out</option>
                    <option value="circle-in">Circular In</option>
                    <option value="circle-out">Circular Out</option>
                    <option value="circle-in-out">Circular In-Out</option>
                    <option value="bounce-in">Bounce In</option>
                    <option value="bounce-out">Bounce Out</option>
                    <option value="bounce-in-out">Bounce In-Out</option>
                    <option value="elastic-in">Elastic In</option>
                    <option value="elastic-out">Elastic Out</option>
                    <option value="elastic-in-out">Elastic In-Out</option>
                </select>

            </div>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}
                >One to Many Mode</label>
                <select id="one-to-many-select" value={oneToMany} onChange={(e) => handleOneToManySettingChange(e.target.value)}>
                    <option value="duplicate">Duplicate</option>
                    <option value="appear">Appear At Center</option>
                </select>

            </div>
            <div>
                <label style={{
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    fontSize: '0.5em',
                    color: 'black',
                    marginRight: '10px'
                }}
                >Path Matching Method</label>
                <select id="matching-method-select" value={matching} onChange={(e) => handleMatchingSettingChange(e.target.value)}>
                    <option value="default">Default</option>
                    <option value="closest-area">Closest Area</option>
                    <option value="closest-distance">Closest Distance</option>
                    <option value="furthest-area">Furthest Area</option>
                    <option value="furthest-distance">Furthest Distance</option>
                    <option value="random">Random</option>
                </select>

            </div>
        </div>
    );
}
export default MorphSettingPanel;