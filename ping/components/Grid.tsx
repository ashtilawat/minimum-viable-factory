"use client";

import { useEffect, useState } from "react";
import { Cell, GRID_SIZE, isOnGrid, manhattan } from "../lib/manhattan";

export type TapRecord = { r: number; c: number; d: number };

type GridProps = {
  hidden: Cell;
  locked: boolean;
  onGameEnd: (taps: TapRecord[], won: boolean) => void;
};

const MAX_TAPS = 4;

export default function Grid({ hidden, locked, onGameEnd }: GridProps) {
  const [tapped, setTapped] = useState<Map<string, number>>(new Map());
  const [tapOrder, setTapOrder] = useState<TapRecord[]>([]);
  const [isLocked, setIsLocked] = useState(locked);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    setIsLocked(locked);
  }, [locked]);

  function cellKey(r: number, c: number) {
    return `${r}-${c}`;
  }

  function handleCellClick(r: number, c: number) {
    if (!isOnGrid(r, c) || isLocked || ended) return;

    const key = cellKey(r, c);
    if (tapped.has(key)) return;

    const d = manhattan({ r, c }, hidden);
    const record: TapRecord = { r, c, d };
    const newTapped = new Map(tapped);
    newTapped.set(key, d);
    const newOrder = [...tapOrder, record];

    setTapped(newTapped);
    setTapOrder(newOrder);

    if (d === 0) {
      setEnded(true);
      setIsLocked(true);
      onGameEnd(newOrder, true);
      return;
    }

    if (newOrder.length >= MAX_TAPS) {
      setEnded(true);
      setIsLocked(true);
      onGameEnd(newOrder, false);
    }
  }

  return (
    <div
      className="grid"
      role="grid"
      aria-label="12 by 12 ping grid"
      data-testid="ping-grid"
    >
      {Array.from({ length: GRID_SIZE }, (_, r) =>
        Array.from({ length: GRID_SIZE }, (_, c) => {
          const key = cellKey(r, c);
          const value = tapped.get(key);
          const isUsed = tapped.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`cell${isUsed ? " used" : ""}${isLocked && !isUsed ? " locked" : ""}`}
              data-testid={`cell-${r}-${c}`}
              aria-label={`cell row ${r} column ${c}`}
              disabled={isLocked}
              onClick={() => handleCellClick(r, c)}
            >
              {isUsed ? value : ""}
            </button>
          );
        }),
      )}
    </div>
  );
}
