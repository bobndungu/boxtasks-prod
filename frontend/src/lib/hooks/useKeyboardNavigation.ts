import { useState, useCallback, useEffect, useMemo } from 'react';

export interface NavigableItem {
  id: string;
  listId?: string;
}

export interface KeyboardNavigationOptions {
  lists: { id: string; title: string }[];
  cardsByList: Map<string, NavigableItem[]>;
  onSelectCard: (card: NavigableItem | null) => void;
  onOpenCard: (card: NavigableItem) => void;
  enabled?: boolean;
}

export interface KeyboardNavigationState {
  focusedListIndex: number;
  focusedCardIndex: number;
  isNavigating: boolean;
}

export function useKeyboardNavigation({
  lists,
  cardsByList,
  onSelectCard,
  onOpenCard,
  enabled = true,
}: KeyboardNavigationOptions) {
  const [state, setState] = useState<KeyboardNavigationState>({
    focusedListIndex: -1,
    focusedCardIndex: -1,
    isNavigating: false,
  });

  // Get the cards for the currently focused list
  const focusedList = lists[state.focusedListIndex];
  const focusedListCards = focusedList
    ? cardsByList.get(focusedList.id) || []
    : [];

  // Get the currently focused card
  const focusedCard = useMemo(() => {
    if (state.focusedCardIndex >= 0 && state.focusedCardIndex < focusedListCards.length) {
      return focusedListCards[state.focusedCardIndex];
    }
    return null;
  }, [focusedListCards, state.focusedCardIndex]);

  // Start keyboard navigation mode
  const startNavigation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      focusedListIndex: prev.focusedListIndex === -1 ? 0 : prev.focusedListIndex,
      focusedCardIndex: prev.focusedCardIndex === -1 ? 0 : prev.focusedCardIndex,
      isNavigating: true,
    }));
  }, []);

  // Exit keyboard navigation mode
  const exitNavigation = useCallback(() => {
    setState({
      focusedListIndex: -1,
      focusedCardIndex: -1,
      isNavigating: false,
    });
    onSelectCard(null);
  }, [onSelectCard]);

  // Move focus to the next list (right)
  const moveRight = useCallback(() => {
    setState((prev) => {
      if (lists.length === 0) return prev;
      const newListIndex = Math.min(prev.focusedListIndex + 1, lists.length - 1);
      const newListCards = cardsByList.get(lists[newListIndex].id) || [];
      return {
        ...prev,
        focusedListIndex: newListIndex,
        focusedCardIndex: Math.min(prev.focusedCardIndex, newListCards.length - 1),
        isNavigating: true,
      };
    });
  }, [lists, cardsByList]);

  // Move focus to the previous list (left)
  const moveLeft = useCallback(() => {
    setState((prev) => {
      if (lists.length === 0) return prev;
      const newListIndex = Math.max(prev.focusedListIndex - 1, 0);
      const newListCards = cardsByList.get(lists[newListIndex].id) || [];
      return {
        ...prev,
        focusedListIndex: newListIndex,
        focusedCardIndex: Math.min(prev.focusedCardIndex, newListCards.length - 1),
        isNavigating: true,
      };
    });
  }, [lists, cardsByList]);

  // Move focus to the next card (down)
  const moveDown = useCallback(() => {
    setState((prev) => {
      if (focusedListCards.length === 0) return prev;
      return {
        ...prev,
        focusedCardIndex: Math.min(prev.focusedCardIndex + 1, focusedListCards.length - 1),
        isNavigating: true,
      };
    });
  }, [focusedListCards]);

  // Move focus to the previous card (up)
  const moveUp = useCallback(() => {
    setState((prev) => {
      if (focusedListCards.length === 0) return prev;
      return {
        ...prev,
        focusedCardIndex: Math.max(prev.focusedCardIndex - 1, 0),
        isNavigating: true,
      };
    });
  }, [focusedListCards]);

  // Move to first card in list
  const moveToFirstCard = useCallback(() => {
    setState((prev) => ({
      ...prev,
      focusedCardIndex: 0,
      isNavigating: true,
    }));
  }, []);

  // Move to last card in list
  const moveToLastCard = useCallback(() => {
    setState((prev) => ({
      ...prev,
      focusedCardIndex: Math.max(focusedListCards.length - 1, 0),
      isNavigating: true,
    }));
  }, [focusedListCards.length]);

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't interfere with input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (event.key === 'Escape') {
          (target as HTMLInputElement).blur();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'l':
          event.preventDefault();
          if (!state.isNavigating) startNavigation();
          else moveRight();
          break;

        case 'ArrowLeft':
        case 'h':
          event.preventDefault();
          if (!state.isNavigating) startNavigation();
          else moveLeft();
          break;

        case 'ArrowDown':
        case 'j':
          event.preventDefault();
          if (!state.isNavigating) startNavigation();
          else moveDown();
          break;

        case 'ArrowUp':
        case 'k':
          event.preventDefault();
          if (!state.isNavigating) startNavigation();
          else moveUp();
          break;

        case 'Enter':
        case ' ':
          if (state.isNavigating && focusedCard) {
            event.preventDefault();
            onOpenCard(focusedCard);
          }
          break;

        case 'Escape':
          if (state.isNavigating) {
            event.preventDefault();
            exitNavigation();
          }
          break;

        case 'Home':
          if (state.isNavigating) {
            event.preventDefault();
            moveToFirstCard();
          }
          break;

        case 'End':
          if (state.isNavigating) {
            event.preventDefault();
            moveToLastCard();
          }
          break;

        case 'g':
          // Press 'g' twice to go to first card, or 'G' (shift+g) to go to last
          if (event.shiftKey) {
            event.preventDefault();
            moveToLastCard();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    state.isNavigating,
    focusedCard,
    startNavigation,
    exitNavigation,
    moveRight,
    moveLeft,
    moveUp,
    moveDown,
    moveToFirstCard,
    moveToLastCard,
    onOpenCard,
  ]);

  // Notify parent when focused card changes
  useEffect(() => {
    if (state.isNavigating) {
      onSelectCard(focusedCard);
    }
  }, [state.isNavigating, focusedCard, onSelectCard]);

  return {
    ...state,
    focusedCard,
    focusedList,
    startNavigation,
    exitNavigation,
    moveRight,
    moveLeft,
    moveUp,
    moveDown,
    moveToFirstCard,
    moveToLastCard,
    // Helper to check if a specific card is focused
    isCardFocused: (cardId: string) =>
      state.isNavigating && focusedCard?.id === cardId,
    // Helper to check if a specific list is focused
    isListFocused: (listId: string) =>
      state.isNavigating && focusedList?.id === listId,
  };
}

// Keyboard shortcuts help text
export const NAVIGATION_SHORTCUTS = [
  { keys: ['←', '→', 'h', 'l'], description: 'Navigate between lists' },
  { keys: ['↑', '↓', 'j', 'k'], description: 'Navigate between cards' },
  { keys: ['Enter', 'Space'], description: 'Open selected card' },
  { keys: ['Escape'], description: 'Exit navigation mode' },
  { keys: ['Home'], description: 'Go to first card' },
  { keys: ['End', 'G'], description: 'Go to last card' },
];
