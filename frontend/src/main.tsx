import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { NotificationsProvider } from './components/notifications';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotificationsProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </NotificationsProvider>
  </StrictMode>,
);
