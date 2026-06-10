import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './demo.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('demo: #root element missing from index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
