import { create } from "zustand";
import type { AppState, MapEntry, ProcessingProgress } from "@/rpc/types";

interface UiStore {
  state: AppState | null;
  setState: (s: AppState) => void;
  patchState: (p: Partial<AppState>) => void;

  connected: boolean;
  setConnected: (c: boolean) => void;

  statusLog: string[];
  pushStatus: (text: string) => void;
  processingProgress: ProcessingProgress | null;
  setProcessingProgress: (p: ProcessingProgress | null) => void;

  mapping: MapEntry[];
  setMapping: (m: MapEntry[]) => void;

  // Live preview key — bumping it forces an MJPEG <img> remount
  liveKey: number;
  bumpLive: () => void;
  liveStarting: boolean;
  setLiveStarting: (value: boolean) => void;
  liveStopping: boolean;
  setLiveStopping: (value: boolean) => void;

  // Preview frame key
  previewKey: number;
  bumpPreview: () => void;

  // Active modal (mapping/settings only; live/preview are inline)
  modal: "none" | "mapping" | "settings";
  setModal: (m: UiStore["modal"]) => void;

  // Main stage content
  stageMode: "idle" | "live" | "preview" | "output";
  setStageMode: (m: UiStore["stageMode"]) => void;
}

export const useUi = create<UiStore>((set) => ({
  state: null,
  setState: (s) => set({ state: s }),
  patchState: (p) =>
    set((curr) => ({ state: curr.state ? { ...curr.state, ...p } : curr.state })),

  connected: false,
  setConnected: (c) => set({ connected: c }),

  statusLog: [],
  pushStatus: (text) =>
    set((curr) => ({ statusLog: [...curr.statusLog.slice(-49), text] })),
  processingProgress: null,
  setProcessingProgress: (p) => set({ processingProgress: p }),

  mapping: [],
  setMapping: (m) => set({ mapping: m }),

  liveKey: 0,
  bumpLive: () => set((c) => ({ liveKey: c.liveKey + 1 })),
  liveStarting: false,
  setLiveStarting: (value) => set({ liveStarting: value }),
  liveStopping: false,
  setLiveStopping: (value) => set({ liveStopping: value }),

  previewKey: 0,
  bumpPreview: () => set((c) => ({ previewKey: c.previewKey + 1 })),

  modal: "none",
  setModal: (m) => set({ modal: m }),

  stageMode: "idle",
  setStageMode: (m) => set({ stageMode: m }),
}));
