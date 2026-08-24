#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the PostgreSQL database to back up}"

output_dir="${1:-backups}"
mkdir -p "$output_dir"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required (PostgreSQL client tools)." >&2
  exit 1
fi
if ! command -v shasum >/dev/null 2>&1; then
  echo "shasum is required to write the backup checksum." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${output_dir%/}/outrank-${timestamp}.dump"

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "$archive"
shasum -a 256 "$archive" > "${archive}.sha256"
cat > "${archive}.manifest" <<EOF
created_at=${timestamp}
format=postgresql-custom
archive=$(basename "$archive")
sha256=$(awk '{print $1}' "${archive}.sha256")
EOF

echo "Created PostgreSQL backup: $archive"
echo "Checksum: ${archive}.sha256"
