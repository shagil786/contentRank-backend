"use client";

import { create } from "zustand";
import type { Category, Entity } from "@/lib/outrank/types";

interface UIState {
  category: Category;
  setCategory: (c: Category) => void;

  timeframe: "today" | "alltime";
  setTimeframe: (t: "today" | "alltime") => void;

  selected: Entity | null;
  openEntity: (e: Entity | null) => void;

  battle: { a: Entity; b: Entity } | null;
  openBattle: (a: Entity, b: Entity) => void;
  closeBattle: () => void;

  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  boostTarget: Entity | null;
  openBoost: (e: Entity) => void;
  closeBoost: () => void;

  addOpen: boolean;
  setAddOpen: (v: boolean) => void;

  subscribeOpen: boolean;
  setSubscribeOpen: (v: boolean) => void;
  subscribeTarget: Entity | null; // when set, subscribe to THIS entity only
  openSubscribeEntity: (e: Entity) => void;

  claimTarget: Entity | null;
  openClaim: (e: Entity) => void;
  closeClaim: () => void;

  editTarget: Entity | null;
  openEdit: (e: Entity) => void;
  closeEdit: () => void;

  shareTarget: Entity | null;
  openShare: (e: Entity) => void;
  closeShare: () => void;

  bidCelebration: { entityName: string; amount: number; ts: number } | null;

  soundOn: boolean;
  toggleSound: () => void;

  tab: "board" | "trending" | "search" | "activity" | "profile";
  setTab: (t: UIState["tab"]) => void;
}

export const useUI = create<UIState>((set) => ({
  category: "global",
  setCategory: (c) => set({ category: c }),

  timeframe: "alltime",
  setTimeframe: (t) => set({ timeframe: t }),

  selected: null,
  openEntity: (e) => set({ selected: e }),

  battle: null,
  openBattle: (a, b) => set({ battle: { a, b } }),
  closeBattle: () => set({ battle: null }),

  searchOpen: false,
  setSearchOpen: (v) => set({ searchOpen: v }),

  boostTarget: null,
  openBoost: (e) => set({ boostTarget: e }),
  closeBoost: () => set({ boostTarget: null }),

  addOpen: false,
  setAddOpen: (v) => set({ addOpen: v }),

  subscribeOpen: false,
  setSubscribeOpen: (v) => set({ subscribeOpen: v, ...(v ? {} : { subscribeTarget: null }) }),
  subscribeTarget: null,
  openSubscribeEntity: (e) => set({ subscribeOpen: true, subscribeTarget: e }),

  claimTarget: null,
  openClaim: (e) => set({ claimTarget: e }),
  closeClaim: () => set({ claimTarget: null }),

  editTarget: null,
  openEdit: (e) => set({ editTarget: e }),
  closeEdit: () => set({ editTarget: null }),

  shareTarget: null,
  openShare: (e) => set({ shareTarget: e }),
  closeShare: () => set({ shareTarget: null }),

  bidCelebration: null,

  soundOn: false,
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

  tab: "board",
  setTab: (t) => set({ tab: t }),
}));
