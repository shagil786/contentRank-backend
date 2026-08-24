#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the PostgreSQL database to restore}"
archive="${1:?Usage: CONFIRM_RESTORE=YES DATABASE_URL=... $0 path/to/backup.dump}"

if [[ ! -f "$archive" ]]; then
  echo "Backup archive not found: $archive" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "Restore is destructive. Re-run with CONFIRM_RESTORE=YES after selecting the exact target database." >&2
  exit 1
fi
if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is required (PostgreSQL client tools)." >&2
  exit 1
fi

if [[ -f "${archive}.sha256" ]] && command -v shasum >/dev/null 2>&1; then
  shasum -a 256 --check "${archive}.sha256"
fi

pg_restore "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$archive"
echo "Restored PostgreSQL backup: $archive"
