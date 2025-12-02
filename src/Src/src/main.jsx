import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Hum man rahe hain ki yeh file React aur Tailwind CSS ke liye zaroori hai.
import './index.css'; 

// Browser ko bataana ki app kahan load hogi
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

