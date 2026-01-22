import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initVersionedStorage } from './lib/utils/versionedStorage'

// Initialize versioned storage to clear stale localStorage on new deployments
initVersionedStorage().catch(console.error);

// In development, unregister any existing service workers to prevent caching issues
// This ensures code changes are immediately visible without manual cache clearing
if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('[Dev] Unregistered service worker to prevent caching issues');
      }
    });
  }
  // Also clear caches in development
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
        console.log(`[Dev] Cleared cache: ${name}`);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
