"""Stateless deterministic noise.

Every random-looking value in the simulator is a pure hash of
``(seed, *parts)`` so that replay and ``seek`` are exact.  There is no
global RNG and no wall-clock dependence anywhere in the physics.
"""

from __future__ import annotations

import hashlib

_UINT64 = 1 << 64


def _digest(seed: int, *parts: object) -> int:
    h = hashlib.blake2b(digest_size=8)
    h.update(str(int(seed)).encode("utf-8"))
    for part in parts:
        h.update(b"\x1f")
        h.update(str(part).encode("utf-8"))
    return int.from_bytes(h.digest(), "big")


def hash_unit(seed: int, *parts: object) -> float:
    """Return a deterministic float in ``[0, 1)``."""
    return _digest(seed, *parts) / _UINT64


def hash_noise(seed: int, *parts: object) -> float:
    """Return a deterministic float in ``[-1, 1]``."""
    return hash_unit(seed, *parts) * 2.0 - 1.0
