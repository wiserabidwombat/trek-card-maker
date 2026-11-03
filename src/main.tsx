import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/exo-2/700-italic.css';
import '@fontsource/fira-sans-condensed/300.css';
import '@fontsource/fira-sans-condensed/300-italic.css';
import '@fontsource/fira-sans-condensed/400.css';
import '@fontsource/fira-sans-condensed/400-italic.css';
import '@fontsource/fira-sans-condensed/500.css';
import '@fontsource/fira-sans-condensed/500-italic.css';
import '@fontsource/fira-sans-condensed/700.css';
import '@fontsource/fira-sans-condensed/700-italic.css';
import './index.css';
import App from './editor/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
