import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { audioState, startAudio } from './table3d/audio';
import { getViewSettings, setViewSettings } from './settings/viewSettings';

// sound is part of the room from the first screen (the browser unmutes it at the first gesture)
startAudio();
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __audioState: audioState, __view: { get: getViewSettings, set: setViewSettings } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
