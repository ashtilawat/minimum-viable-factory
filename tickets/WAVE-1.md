# Wave 1 — PM + Parallel Dev Operating Pack

**Parent session:** `T-HARNESS-PACK` · **Harness:** `pm` · **Tags:** `factory`, `cloud-agent`, `pm`

Installs harness templates under `harnesses/` so **Ori** can swarm Cursor Cloud Agents with collision-safe scopes.

## Rules (this wave)

- One ticket → one branch → one agent. Never share a branch.
- **Pia** specs · **Cody** implements · **Lori** reviews — never Cody and Lori on the same ticket.
- Wave 1 scopes are **disjoint** — safe to launch in parallel.
- Lori review tickets belong in Wave 2 (`tickets/WAVE-2.md`, not yet opened).

---

## Ticket table

| Ticket ID | Name | Scope (exclusive files) | Branch | Acceptance | Harness | Agent | Wave | Collision group | Blocked by | Parent | Notes |
|-----------|------|-------------------------|--------|------------|---------|-------|------|-----------------|------------|--------|-------|
| T-HARNESS-PACK | Wave 1 plan + ticket table | `tickets/WAVE-1.md` | `cursor/harness-wave-plan-b7ae` | 1. Table lists ≥3 parallel-safe Cody tickets<br>2. All harness files covered<br>3. No scope path overlap across Wave 1 Cody rows<br>4. Columns match factory schema | pm | Pia | 0 | CG-PACK | — | — | Spec-only; opens before Cody swarm |
| T-HARNESS-PM | PM harness template | `harnesses/pm.md` | `cursor/harness-pm-b7ae` | 1. File exists<br>2. Contains Wordle-class 4-part contract reminder<br>3. Contains slop watch section<br>4. Contains Gate 1 output shape<br>5. States parallel wave rules (one ticket/branch, disjoint scope) | dev | Cody | 1 | CG-PM | T-HARNESS-PACK | T-HARNESS-PACK | Gate 1 spec harness for Pia role |
| T-HARNESS-ARCH | Architect harness template | `harnesses/architect.md` | `cursor/harness-architect-b7ae` | 1. File exists<br>2. Files affected = paths only rule stated<br>3. Contains Definition of done section<br>4. Contains out of scope section<br>5. Contains Gate 2 output shape | dev | Cody | 1 | CG-ARCH | T-HARNESS-PACK | T-HARNESS-PACK | Plan-only; no code |
| T-HARNESS-DEV | Dev worker harness template | `harnesses/dev.md` | `cursor/harness-dev-b7ae` | 1. File exists<br>2. States TDD requirement<br>3. States one branch / stop at acceptance<br>4. States no extra scope<br>5. Targets Cursor Cloud Agent workflow | dev | Cody | 1 | CG-DEV | T-HARNESS-PACK | T-HARNESS-PACK | Cody role card |
| T-HARNESS-REVIEW | Review/QA harness template | `harnesses/review.md` | `cursor/harness-review-b7ae` | 1. File exists<br>2. Contains deterministic evals section<br>3. Contains slop rubric table<br>4. States do not edit Cody-owned files<br>5. Lori/Cody separation explicit | dev | Cody | 1 | CG-REVIEW | T-HARNESS-PACK | T-HARNESS-PACK | Lori role card; Wave 2 reviews use this doc |

---

## Collision matrix (Wave 1 Cody tickets)

| | pm.md | architect.md | dev.md | review.md |
|---|:---:|:---:|:---:|:---:|
| **T-HARNESS-PM** | ✓ | — | — | — |
| **T-HARNESS-ARCH** | — | ✓ | — | — |
| **T-HARNESS-DEV** | — | — | ✓ | — |
| **T-HARNESS-REVIEW** | — | — | — | ✓ |

All Wave 1 Cody tickets: **disjoint** — Ori may launch in parallel after `T-HARNESS-PACK` merges.

---

## Suggested launch order for Ori

1. **Pia** completes `T-HARNESS-PACK` (this file + parent spec) → PR → Gate 1.
2. **Architect** (optional batch) — no file overlap; may run once per Cody ticket or skip for template-only work.
3. **Cody ×4** in parallel — one agent per row, branch per row.
4. **Lori ×4** in Wave 2 — each blocked by matching Cody ticket; one review PR comment each, no file edits.

---

## Out of scope (entire pack)

- Product / game code (PING shipped; no new INIT mush)
- GitHub repo creation, Vercel, Supabase provisioning
- Secrets, LANGFUSE keys, pip-install langfuse, `.env` with credentials
- Changes outside `harnesses/*` and `tickets/WAVE-1.md`
