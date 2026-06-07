CREATE TABLE IF NOT EXISTS mirror_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  from_device TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_mirror_room ON mirror_messages(room_id, created_at);
