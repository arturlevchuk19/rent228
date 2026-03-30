import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const isCrossOriginFrameSecurityError = (message: string) =>
  message.includes('SecurityError') &&
  message.includes('Failed to read a named property') &&
  message.includes('Blocked a frame with origin');

window.addEventListener('error', (event) => {
  const message = event.error?.message || event.message || '';
  if (isCrossOriginFrameSecurityError(message)) {
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message =
    typeof reason === 'string'
      ? reason
      : reason?.message || '';

  if (isCrossOriginFrameSecurityError(message)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
