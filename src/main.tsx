import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme } from './theme';
import { startUpdates } from './update';
import { initLang } from './i18n';
import './styles.css';

// before the first paint, so a forced theme does not flash the system one
applyTheme();
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => applyTheme());

startUpdates();

// the Korean text loads before the first render, so the app never flashes English
void initLang().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
