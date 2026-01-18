import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MentionToast {
  id: string;
  notificationId: string;
  cardId: string;
  cardTitle: string;
  actorName: string;
  message: string;
  createdAt: string;
}

interface MentionToastState {
  toasts: MentionToast[];
  dismissedIds: string[]; // IDs of dismissed notifications (persisted)
  addToast: (toast: MentionToast) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
  isToastDismissed: (notificationId: string) => boolean;
  setToasts: (toasts: MentionToast[]) => void;
}

export const useMentionToastStore = create<MentionToastState>()(
  persist(
    (set, get) => ({
      toasts: [],
      dismissedIds: [],

      addToast: (toast) => {
        const { toasts, dismissedIds } = get();
        // Don't add if already exists or was dismissed
        if (toasts.some((t) => t.notificationId === toast.notificationId)) return;
        if (dismissedIds.includes(toast.notificationId)) return;

        set({ toasts: [...toasts, toast] });
      },

      removeToast: (id) => {
        const { toasts } = get();
        const toast = toasts.find((t) => t.id === id);
        if (toast) {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
            // Add to dismissed list so it doesn't reappear
            dismissedIds: [...state.dismissedIds, toast.notificationId],
          }));
        }
      },

      clearAll: () => {
        const { toasts } = get();
        const dismissedIds = toasts.map((t) => t.notificationId);
        set((state) => ({
          toasts: [],
          dismissedIds: [...state.dismissedIds, ...dismissedIds],
        }));
      },

      isToastDismissed: (notificationId) => {
        return get().dismissedIds.includes(notificationId);
      },

      setToasts: (toasts) => {
        const { dismissedIds } = get();
        // Filter out already dismissed toasts
        const filteredToasts = toasts.filter(
          (t) => !dismissedIds.includes(t.notificationId)
        );
        set({ toasts: filteredToasts });
      },
    }),
    {
      name: 'boxtasks-mention-toasts',
      partialize: (state) => ({
        // Only persist dismissed IDs, not active toasts
        // Active toasts will be loaded from the server on page load
        dismissedIds: state.dismissedIds,
      }),
    }
  )
);

// Clean up old dismissed IDs (keep only last 100)
const cleanupDismissedIds = () => {
  const state = useMentionToastStore.getState();
  if (state.dismissedIds.length > 100) {
    useMentionToastStore.setState({
      dismissedIds: state.dismissedIds.slice(-100),
    });
  }
};

// Run cleanup on store initialization
if (typeof window !== 'undefined') {
  setTimeout(cleanupDismissedIds, 1000);
}
