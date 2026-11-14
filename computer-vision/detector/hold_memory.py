"""Remember the last obstacle sentence so a holding cue still has speech."""

from __future__ import annotations

from dataclasses import replace

from policy import Cue

SPOKEN_REASONS = frozenset({"pass", "blocked", "approaching", "head", "drop", "path"})
CLEAR_REASONS = frozenset(
    {"clear", "pending", "unsteady", "camera-missing", "model-missing"}
)


def apply_hold_memory(cue: Cue, remembered: Cue | None) -> tuple[Cue, Cue | None]:
    """Return the cue to publish and the obstacle sentence to keep.

    A spoken cue is remembered. While the latest reason is ``holding``, the
    published cue carries the remembered sentence and its fields. Quiet
    reasons that mean "nothing to say" clear the memory.
    """
    if cue.reason in SPOKEN_REASONS:
        return cue, cue
    if cue.reason in CLEAR_REASONS:
        return cue, None
    if cue.reason == "holding" and remembered is not None:
        return replace(remembered, kind=cue.kind, reason="holding"), remembered
    return cue, remembered
