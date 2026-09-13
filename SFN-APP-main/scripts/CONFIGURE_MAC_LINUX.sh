#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/wrangler.jsonc"
printf 'D1 database_id của sfn-app-db: '
read -r D1
[ -n "$D1" ] || { echo 'D1 database_id không được để trống.'; exit 1; }
python3 - "$CONFIG" "$D1" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); d=sys.argv[2]
s=p.read_text(); p.write_text(s.replace('REPLACE_WITH_YOUR_D1_DATABASE_ID',d))
PY
echo 'Đã cập nhật wrangler.jsonc.'
echo 'Tiếp theo: npm install && npx wrangler login && npm run db:migrate && npm run validate && npm run deploy'
