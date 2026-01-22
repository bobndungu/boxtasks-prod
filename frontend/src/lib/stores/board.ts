import { create } from 'zustand';
import type { Board } from '../api/boards';

// Staleness threshold in milliseconds (1 minute)
const STALE_THRESHOLD = 60 * 1000;

interface BoardState {
  boards: Board[];
  currentBoard: Board | null;
  starredBoards: Board[];
  recentBoards: Board[];
  starredBoardsLastFetched: number | null;
  recentBoardsLastFetched: number | null;
  isLoading: boolean;
  error: string | null;
  setBoards: (boards: Board[]) => void;
  addBoard: (board: Board) => void;
  updateBoard: (board: Board) => void;
  removeBoard: (id: string) => void;
  setCurrentBoard: (board: Board | null) => void;
  setStarredBoards: (boards: Board[]) => void;
  setRecentBoards: (boards: Board[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isStarredBoardsStale: () => boolean;
  isRecentBoardsStale: () => boolean;
  invalidateBoardsCache: () => void;
}

export const useBoardStore = create<BoardState>()((set, get) => ({
  boards: [],
  currentBoard: null,
  starredBoards: [],
  recentBoards: [],
  starredBoardsLastFetched: null,
  recentBoardsLastFetched: null,
  isLoading: false,
  error: null,
  setBoards: (boards) => set({ boards, isLoading: false }),
  addBoard: (board) =>
    set((state) => ({ boards: [...state.boards, board] })),
  updateBoard: (board) =>
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === board.id ? board : b
      ),
      currentBoard:
        state.currentBoard?.id === board.id
          ? board
          : state.currentBoard,
      starredBoards: board.starred
        ? state.starredBoards.some((b) => b.id === board.id)
          ? state.starredBoards.map((b) => b.id === board.id ? board : b)
          : [...state.starredBoards, board]
        : state.starredBoards.filter((b) => b.id !== board.id),
    })),
  removeBoard: (id) =>
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== id),
      currentBoard:
        state.currentBoard?.id === id ? null : state.currentBoard,
      starredBoards: state.starredBoards.filter((b) => b.id !== id),
      recentBoards: state.recentBoards.filter((b) => b.id !== id),
    })),
  setCurrentBoard: (currentBoard) => set({ currentBoard }),
  setStarredBoards: (starredBoards) => set({ starredBoards, starredBoardsLastFetched: Date.now() }),
  setRecentBoards: (recentBoards) => set({ recentBoards, recentBoardsLastFetched: Date.now() }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  isStarredBoardsStale: () => {
    const { starredBoardsLastFetched } = get();
    if (!starredBoardsLastFetched) return true;
    return Date.now() - starredBoardsLastFetched > STALE_THRESHOLD;
  },
  isRecentBoardsStale: () => {
    const { recentBoardsLastFetched } = get();
    if (!recentBoardsLastFetched) return true;
    return Date.now() - recentBoardsLastFetched > STALE_THRESHOLD;
  },
  invalidateBoardsCache: () => set({ starredBoardsLastFetched: null, recentBoardsLastFetched: null }),
}));
