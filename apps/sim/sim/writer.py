"""Raw store writer.

Rows mimic the client's raw ``components`` shape (PLAN 6.2).  When a store
DSN is configured *and* ``psycopg`` is importable the writer COPYs into
``site_store.points``; otherwise it keeps an in-memory list so tests can
inspect what would have been written.  Batching keeps the writer able to
sustain the required row rate conceptually (large COPY batches).
"""

from __future__ import annotations

import os
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

try:  # guarded: psycopg is optional
    import psycopg  # type: ignore
except Exception:  # noqa: BLE001 - optional dependency; absence is expected  # pragma: no cover - environment dependent
    psycopg = None  # type: ignore


@dataclass
class RawRow:
    time: str
    measurement: str = "components"
    entity_id: str = ""
    field: str = ""
    value: float | None = None
    is_delayed: bool = False

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> RawRow:
        return cls(
            time=str(d["time"]),
            measurement=str(d.get("measurement", "components")),
            entity_id=str(d.get("entity_id", "")),
            field=str(d.get("field", "")),
            value=None if d.get("value") is None else float(d["value"]),
            is_delayed=bool(d.get("is_delayed", False)),
        )

    def as_tuple(self) -> tuple[Any, ...]:
        return (
            self.time,
            self.measurement,
            self.entity_id,
            self.field,
            self.value,
            self.is_delayed,
        )


_INSERT = (
    "INSERT INTO site_store.points (time, measurement, entity_id, field, value, is_delayed) "
    "VALUES (%s, %s, %s, %s, %s, %s)"
)


class Writer:
    def __init__(self, batch_size: int = 5000, dsn: str | None = None) -> None:
        self.batch_size = max(1, int(batch_size))
        self.dsn = dsn if dsn is not None else os.environ.get("SITE_STORE_DSN")
        self._batch: list[RawRow] = []
        self.rows: list[RawRow] = []
        self.mode = "memory"
        self._conn = None
        self._cur = None
        if self.dsn and psycopg is not None:
            try:  # pragma: no cover - requires a real database
                self._conn = psycopg.connect(self.dsn, autocommit=True)
                self._cur = self._conn.cursor()
                self.mode = "postgres"
            except Exception:  # noqa: BLE001 - fall back to in-memory store
                self._conn = None
                self._cur = None
                self.mode = "memory"

    # -- public API -------------------------------------------------------
    def add(self, row: RawRow | dict[str, Any]) -> None:
        if isinstance(row, dict):
            row = RawRow.from_dict(row)
        self._batch.append(row)
        if len(self._batch) >= self.batch_size:
            self.flush()

    def add_many(self, rows: Iterable[RawRow | dict[str, Any]]) -> None:
        for row in rows:
            self.add(row)

    def flush(self) -> int:
        if not self._batch:
            return 0
        n = len(self._batch)
        if self._cur is not None:  # pragma: no cover - requires a real database
            with self._cur.copy(_INSERT) as copy:  # type: ignore[attr-defined]
                for row in self._batch:
                    copy.write_row(row.as_tuple())
        else:
            self.rows.extend(self._batch)
        self._batch.clear()
        return n

    def recent(self, limit: int = 100) -> list[RawRow]:
        pending = list(self._batch)
        combined = self.rows + pending
        if limit <= 0:
            return combined
        return combined[-limit:]

    def __len__(self) -> int:
        return len(self.rows) + len(self._batch)
