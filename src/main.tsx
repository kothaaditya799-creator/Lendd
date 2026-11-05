import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { requestStoragePersistence } from './db/storagePersistence';
import { registerServiceWorker } from './utils/pwaRegistration';
import './tests/runTests';

// Register PWA Service Worker for offline resilience
registerServiceWorker();

// Request OS-level storage persistence on app launch
requestStoragePersistence().then((status) => {
  if (status.isPersisted) {
    console.log('[StoragePersistence] IndexedDB storage is securely persisted.');
  } else {
    console.log('[StoragePersistence] Storage persistence was not granted or not supported.');
  }
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
