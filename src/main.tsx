import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/colors_and_type.css';
import './styles/app.css';
import { App } from './ui/App';

// Restore the saved theme before first paint.
const savedTheme = localStorage.getItem('nsda-theme');
if (savedTheme === 'dark' || savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
