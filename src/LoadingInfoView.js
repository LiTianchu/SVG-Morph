import React, { useEffect, useState, useRef } from 'react';

function LoadingInfoView({ loadingInfoList, isMorphing}) {

    useEffect(() => {
        const loadingInfoQueue = document.getElementById("loading-info-queue");
        loadingInfoQueue.innerHTML = '';
        for (let i = 0; i < loadingInfoList.length; i++) {
            const loadingInfo = loadingInfoList[i];
            const p = document.createElement('p');
            p.style.textAlign = "center"
            p.append(loadingInfo.text);   
            loadingInfoQueue.append(p);
        }
    }, [loadingInfoList]);

    return (
        <div id="loading-info-component" style={{position:'absolute', width:"100%", height:"100%"}}>
            <div id="loading-info-queue" style={{ display: isMorphing ? 'none' : 'flex', 
                                                    justifyContent: 'center', 
                                                    alignItems: 'center',
                                                    fontSize:'14px', 
                                                    color:'black',
                                                    width:'auto',
                                                    height:'100%'}}>
            </div>
        </div>
    );
}

export default LoadingInfoView;
