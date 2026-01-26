/**
 * Versioned localStorage utility
 *
 * Automatically invalidates localStorage when a new version is deployed.
 * This prevents stale settings from persisting across deployments.
 *
 * Usage:
 * 1. Call initVersionedStorage() once on app startup (in main.tsx or App.tsx)
 * 2. Use versionedStorage.get/set for all localStorage operations
 */

const STORAGE_VERSION_KEY = 'boxtasks_storage_version';
const AUTH_VERSION_KEY = 'boxtasks_auth_version';
const STORAGE_PREFIX = 'boxtasks_';

// INCREMENT THIS NUMBER TO FORCE ALL USERS TO LOG OUT
// This should be incremented whenever there's a security fix that requires
// clearing cached user data across all sessions.
const CURRENT_AUTH_VERSION = 4; // Incremented for checkAuth identity verification fix on 2026-01-26

interface StorageConfig {
  // Keys that should persist across versions (e.g., auth tokens)
  persistentKeys: string[];
}

const config: StorageConfig = {
  // These keys will NOT be cleared on normal version change
  // But WILL be cleared when AUTH_VERSION changes (security updates)
  persistentKeys: [
    'boxtasks_auth', // Zustand auth store (contains tokens and user)
    'boxtasks_auth_token',
    'boxtasks_refresh_token',
    'boxtasks_user',
    'boxtasks_theme', // User's theme preference should persist
  ],
};

let currentVersion: string | null = null;
let isInitialized = false;

/**
 * Fetch the current build version from version.json
 */
async function fetchBuildVersion(): Promise<string | null> {
  try {
    // In development, use a static version
    if (import.meta.env.DEV) {
      return 'dev';
    }

    const response = await fetch('/version.json', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      console.warn('[VersionedStorage] Failed to fetch version.json');
      return null;
    }

    const data = await response.json();
    return data.version || null;
  } catch (error) {
    console.warn('[VersionedStorage] Error fetching version:', error);
    return null;
  }
}

/**
 * Clear all boxtasks localStorage keys except persistent ones
 */
function clearNonPersistentStorage(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      // Check if this key should persist
      const shouldPersist = config.persistentKeys.some(
        persistentKey => key === persistentKey || key.startsWith(persistentKey + '_')
      );

      if (!shouldPersist) {
        keysToRemove.push(key);
      }
    }
  }

  // Remove the keys (can't do it in the loop above as it modifies the collection)
  keysToRemove.forEach(key => {
    console.log('[VersionedStorage] Clearing stale key:', key);
    localStorage.removeItem(key);
  });

  if (keysToRemove.length > 0) {
    console.log(`[VersionedStorage] Cleared ${keysToRemove.length} stale storage keys`);
  }
}

/**
 * Force clear ALL boxtasks localStorage keys including auth (for security updates)
 */
function forceLogoutAllUsers(): void {
  console.log('[VersionedStorage] SECURITY UPDATE: Forcing logout for all users');

  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      // Only keep theme preference, clear everything else including auth
      if (key !== 'boxtasks_theme') {
        keysToRemove.push(key);
      }
    }
  }

  // Also clear non-prefixed auth keys
  ['access_token', 'refresh_token', 'token_expires_at'].forEach(key => {
    if (localStorage.getItem(key)) {
      keysToRemove.push(key);
    }
  });

  keysToRemove.forEach(key => {
    console.log('[VersionedStorage] Force clearing:', key);
    localStorage.removeItem(key);
  });

  console.log(`[VersionedStorage] Force cleared ${keysToRemove.length} storage keys for security update`);
}

/**
 * Initialize versioned storage - call this once on app startup
 * This checks if the app version has changed and clears stale storage if needed
 */
export async function initVersionedStorage(): Promise<void> {
  if (isInitialized) {
    return;
  }

  // SECURITY CHECK: Check auth version first
  // If auth version changed, force logout ALL users (clears auth data)
  const storedAuthVersion = localStorage.getItem(AUTH_VERSION_KEY);
  const currentAuthVersionStr = CURRENT_AUTH_VERSION.toString();

  if (storedAuthVersion !== currentAuthVersionStr) {
    console.log(`[VersionedStorage] AUTH VERSION changed: ${storedAuthVersion || 'none'} -> ${currentAuthVersionStr}`);
    forceLogoutAllUsers();
    localStorage.setItem(AUTH_VERSION_KEY, currentAuthVersionStr);
    // After force logout, user will need to re-authenticate
    // Redirect to login page if not already there
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      console.log('[VersionedStorage] Redirecting to login after security update');
      window.location.href = '/login?security_update=1';
      return;
    }
  }

  const buildVersion = await fetchBuildVersion();
  if (!buildVersion) {
    console.warn('[VersionedStorage] Could not determine build version, skipping cache invalidation');
    isInitialized = true;
    return;
  }

  currentVersion = buildVersion;
  const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);

  if (storedVersion !== buildVersion) {
    console.log(`[VersionedStorage] Version changed: ${storedVersion || 'none'} -> ${buildVersion}`);
    clearNonPersistentStorage();
    localStorage.setItem(STORAGE_VERSION_KEY, buildVersion);
  } else {
    console.log(`[VersionedStorage] Version unchanged: ${buildVersion}`);
  }

  isInitialized = true;
}

/**
 * Versioned storage interface
 * Use this instead of direct localStorage access for automatic version management
 */
export const versionedStorage = {
  /**
   * Get an item from localStorage
   * @param key - The storage key (will be prefixed with 'boxtasks_' if not already)
   * @param defaultValue - Default value if key doesn't exist
   */
  get<T>(key: string, defaultValue: T): T {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    const stored = localStorage.getItem(fullKey);

    if (stored === null) {
      return defaultValue;
    }

    try {
      return JSON.parse(stored) as T;
    } catch {
      // If it's not valid JSON, return as string (cast needed for generic)
      return stored as unknown as T;
    }
  },

  /**
   * Set an item in localStorage
   * @param key - The storage key (will be prefixed with 'boxtasks_' if not already)
   * @param value - The value to store (will be JSON stringified)
   */
  set<T>(key: string, value: T): void {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    localStorage.setItem(fullKey, JSON.stringify(value));
  },

  /**
   * Remove an item from localStorage
   * @param key - The storage key (will be prefixed with 'boxtasks_' if not already)
   */
  remove(key: string): void {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(fullKey);
  },

  /**
   * Check if an item exists in localStorage
   * @param key - The storage key (will be prefixed with 'boxtasks_' if not already)
   */
  has(key: string): boolean {
    const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
    return localStorage.getItem(fullKey) !== null;
  },

  /**
   * Get the current build version
   */
  getVersion(): string | null {
    return currentVersion;
  },

  /**
   * Check if storage has been initialized
   */
  isReady(): boolean {
    return isInitialized;
  },

  /**
   * Force clear all non-persistent storage (useful for testing or manual cache clear)
   */
  clearAll(): void {
    clearNonPersistentStorage();
  },
};

export default versionedStorage;
