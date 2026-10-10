import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { App } from './pages/App';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { AuthProvider, RequireSession } from './components/Auth';
import './style.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route path="*" element={<RequireSession><App /></RequireSession>} />
  </Routes></AuthProvider></BrowserRouter></React.StrictMode>,
);
