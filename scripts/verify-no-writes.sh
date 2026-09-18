#!/usr/bin/env bash
# Re-pull the app database and diff its row counts against the baseline
# taken before screenshot capture.
#
# Why all three files: bpdtools.db itself is a single empty page -- every
# entry lives in the -wal until a checkpoint. Copying bpdtools.db alone
# yields a snapshot that looks like a backup and reads as zero rows.
set -euo pipefail

PKG=com.bpdtools.app
BK="${1:-$HOME/bpdtools-backups/2026-09-17-prescreenshot}"
NOW="$(mktemp -d)"
trap 'rm -rf "$NOW"' EXIT

adb shell am force-stop "$PKG" >/dev/null
sleep 1
for f in bpdtools.db bpdtools.db-wal bpdtools.db-shm; do
  adb exec-out run-as "$PKG" cat "databases/$f" > "$NOW/$f"
done

base="$(cat "$BK/baseline.txt")"
now="$(sqlite3 "$NOW/bpdtools.db" "SELECT COUNT(*)||'|'||SUM(deleted) FROM emotion_entries;")"

echo "baseline (total|deleted): $base"
echo "now      (total|deleted): $now"
if [ "$base" = "$now" ]; then
  echo "PASS - no rows added, removed or tombstoned."
else
  echo "FAIL - the database changed. Restore with:"
  echo "  adb shell am force-stop $PKG"
  echo "  for f in bpdtools.db bpdtools.db-wal bpdtools.db-shm; do"
  echo "    adb push $BK/\$f /data/local/tmp/\$f"
  echo "    adb shell run-as $PKG cp /data/local/tmp/\$f databases/\$f"
  echo "  done"
  exit 1
fi
