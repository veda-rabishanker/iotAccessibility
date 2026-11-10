"""Remember the last obstacle sentence so a holding cue still has speech."""

from __future__ import annotations

from policy import Cue

CLEAR_REASONS = frozenset(
    {"clear", "pending", "unsteady", "camera-missing", "model-missing", "esp32"}
)


def apply_hold_memory(cue: Cue, remembered: Cue | None) -> tuple[Cue, Cue | None]:
    """Return the cue to publish and the obstacle sentence to keep.

    Remember speech, class_name, and side from ``pass`` or ``blocked``. While
    the latest reason is ``holding``, fill those fields from memory. Clear
    memory on ``clear``, ``pending``, ``unsteady``, ``camera-missing``,
    ``model-missing``, and ``esp32``.
    """
    if cue.reason in ("pass", "blocked"):
        return cue, cue
    if cue.reason in CLEAR_REASONS:
        return cue, None
    if cue.reason == "holding" and remembered is not None:
        return (
            Cue(
                kind=cue.kind,
                speech=remembered.speech,
                reason="holding",
                side=remembered.side,
                class_name=remembered.class_name,
            ),
            remembered,
        )
    return cue, remembered
