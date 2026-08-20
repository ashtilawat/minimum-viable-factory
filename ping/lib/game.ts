import { Cell, isOnGrid, manhattan } from "./manhattan";

export type TapRecord = { r: number; c: number; d: number };

export type GameState = {
  hidden: Cell;
  taps: TapRecord[];
  locked: boolean;
  won: boolean;
};

export const MAX_TAPS = 4;

/** Apply a tap; retaps and off-grid taps leave state unchanged. */
export function applyTap(state: GameState, r: number, c: number): GameState {
  if (state.locked || !isOnGrid(r, c)) return state;
  if (state.taps.some((t) => t.r === r && t.c === c)) return state;

  const d = manhattan({ r, c }, state.hidden);
  const taps = [...state.taps, { r, c, d }];

  if (d === 0) {
    return { ...state, taps, locked: true, won: true };
  }
  if (taps.length >= MAX_TAPS) {
    return { ...state, taps, locked: true, won: false };
  }
  return { ...state, taps };
}

export function initialState(hidden: Cell): GameState {
  return { hidden, taps: [], locked: false, won: false };
}
