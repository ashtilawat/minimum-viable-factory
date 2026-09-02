"""Detect scope and branch collisions among tickets scheduled in the same wave."""

from __future__ import annotations

from typing import Any, TypedDict


class Ticket(TypedDict):
    id: str
    scope: list[str]
    branch: str
    wave: int


class Collision(TypedDict):
    tickets: list[str]
    reason: str


def _normalize_path(path: str) -> str:
    """Strip trailing slashes so prefix checks use path boundaries."""
    return path.strip().rstrip("/")


def _paths_overlap(left: str, right: str) -> bool:
    """True when paths are equal or one is a directory prefix of the other."""
    a = _normalize_path(left)
    b = _normalize_path(right)
    if not a or not b:
        return False
    if a == b:
        return True
    return a.startswith(b + "/") or b.startswith(a + "/")


def _scopes_overlap(left: list[str], right: list[str]) -> bool:
    return any(_paths_overlap(a, b) for a in left for b in right)


def _pair_key(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def find_collisions(tickets: list[dict[str, Any]]) -> list[Collision]:
    """Return collision records for tickets sharing a wave with conflicting scope or branch.

    Rules:
    - Same wave + overlapping scope paths (including directory prefixes) → collision
    - Same wave + identical branch → collision
    - Different waves may overlap freely
    - Empty scope list or blank branch on a ticket → collision
    """
    collisions: list[Collision] = []
    seen_pairs: set[tuple[str, str]] = set()

    def add_pair(a: str, b: str, reason: str) -> None:
        key = _pair_key(a, b)
        if key in seen_pairs:
            return
        seen_pairs.add(key)
        collisions.append({"tickets": [key[0], key[1]], "reason": reason})

    for ticket in tickets:
        ticket_id = str(ticket.get("id", ""))
        scope = ticket.get("scope") or []
        branch = (ticket.get("branch") or "").strip()

        if not scope or not branch:
            add_pair(ticket_id, ticket_id, "empty_scope_or_branch")

    by_wave: dict[int, list[Ticket]] = {}
    for ticket in tickets:
        ticket_id = str(ticket.get("id", ""))
        scope = list(ticket.get("scope") or [])
        branch = (ticket.get("branch") or "").strip()
        wave = int(ticket.get("wave", 0))
        by_wave.setdefault(wave, []).append(
            {"id": ticket_id, "scope": scope, "branch": branch, "wave": wave}
        )

    for wave_tickets in by_wave.values():
        for i, left in enumerate(wave_tickets):
            for right in wave_tickets[i + 1 :]:
                if left["branch"] and right["branch"] and left["branch"] == right["branch"]:
                    add_pair(left["id"], right["id"], "same_branch")
                if _scopes_overlap(left["scope"], right["scope"]):
                    add_pair(left["id"], right["id"], "scope_overlap")

    return collisions
