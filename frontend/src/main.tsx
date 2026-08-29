import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './command-center.css';
import './mission-map.css';
import { installInteractionFixes } from './interaction-fixes';

installInteractionFixes();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
