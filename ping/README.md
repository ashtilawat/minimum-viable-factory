# PING

A daily web game: find one hidden cell on a 12×12 grid in four taps. Each tap reveals only the Manhattan distance to the hidden cell.

## Rules

Tap a cell → you get a number; 0 wins.

- One puzzle per UTC calendar day, same hidden cell worldwide.
- Four taps maximum; retapping a cell or tapping off-grid does not consume a tap.
- After four misses the board locks; the share card never reveals the hidden cell.

## PING_EPOCH_UTC

`2026-01-01` — puzzle **#1** is the UTC date 2026-01-01; **#n** counts UTC calendar days from the epoch.

## Development

```bash
cd ping
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No login required.

## Share format

**Win** (k taps): `PING #n k/4`, one `📡d` line per miss (never `📡0`), then `🎯`.

**Honest lose**: `PING #n X/4` plus exactly four `📡d` lines. No target emoji, coordinates, or map.

## Project layout

Self-contained Next.js App Router app under `ping/`. The Python factory harness at the repo root is unchanged.
