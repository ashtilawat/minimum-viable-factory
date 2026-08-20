"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Grid, { TapRecord } from "../components/Grid";
import Rules from "../components/Rules";
import ShareButton from "../components/ShareButton";
import { puzzleNumber, todayUtcDate } from "../lib/epoch";
import { hiddenForDate } from "../lib/seed";
import { buildShareText } from "../lib/share";

export default function Home() {
  const puzzleDateRef = useRef(todayUtcDate());
  const utcDate = puzzleDateRef.current;

  const hidden = useMemo(() => hiddenForDate(utcDate), [utcDate]);
  const puzzleNum = puzzleNumber(utcDate);

  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [taps, setTaps] = useState<TapRecord[]>([]);
  const [shareText, setShareText] = useState("");

  const handleGameEnd = useCallback(
    (finalTaps: TapRecord[], didWin: boolean) => {
      setGameOver(true);
      setWon(didWin);
      setTaps(finalTaps);
      setShareText(buildShareText(utcDate, finalTaps, didWin));
    },
    [utcDate],
  );

  return (
    <main className="container" data-testid="ping-app">
      <header>
        <h1>PING</h1>
        <p className="puzzle-id" data-testid="puzzle-number">
          #{puzzleNum}
        </p>
      </header>
      <Rules />
      <Grid hidden={hidden} locked={false} onGameEnd={handleGameEnd} />
      {gameOver && (
        <p className="result" data-testid="result">
          {won ? "Signal found!" : "Out of taps."}
        </p>
      )}
      <ShareButton shareText={shareText} disabled={!gameOver} />
    </main>
  );
}
