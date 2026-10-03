import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { audioState, startAudio } from './table3d/audio';
import { getViewSettings, setViewSettings } from './settings/viewSettings';

// sound is part of the room from the first screen (the browser unmutes it at the first gesture)
startAudio();
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __audioState: audioState, __view: { get: getViewSettings, set: setViewSettings } });

// the numerals font is only used inside canvases (cards, chalk numbers): ask for it up front, or the
// first cards would be painted in the fallback
const fontsReady = Promise.race([
  Promise.all([document.fonts.load('bold 40px "Old Standard TT"'), document.fonts.load('700 22px "Old Standard TT"')]).catch(() => undefined),
  new Promise((r) => setTimeout(r, 2500)),
]);

void fontsReady.then(() => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
));
