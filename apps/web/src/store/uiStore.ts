import { create } from "zustand";

export interface Toast {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
}

interface UiState {
  toasts: Toast[];
  sidebarOpen: boolean;
  showToast: (tone: Toast["tone"], message: string) => void;
  dismissToast: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  showToast: (tone, message) => {
    const id = `toast-${Math.random().toString(36).slice(2, 9)}`;
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
