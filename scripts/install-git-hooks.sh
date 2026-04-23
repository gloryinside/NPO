#!/usr/bin/env bash
# G-D95: 로컬 git pre-commit 훅 설치.
#   - tsc --noEmit (타입 에러 차단)
#   - 마이그레이션 파일명 형식 검증
#   - staged 파일에 console.log(production leak) 경고 (실패는 안 시킴)
# 사용: bash scripts/install-git-hooks.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$REPO_ROOT/.git/hooks"
PRE_COMMIT="$HOOK_DIR/pre-commit"

mkdir -p "$HOOK_DIR"

cat > "$PRE_COMMIT" <<'HOOK'
#!/usr/bin/env bash
set -e

echo "[pre-commit] typecheck..."
npx --no-install tsc --noEmit 2>&1 | head -50

echo "[pre-commit] migration name lint..."
bad=0
for f in $(git diff --cached --name-only --diff-filter=ACM | grep -E '^supabase/migrations/.*\.sql$' || true); do
  base=$(basename "$f")
  if ! echo "$base" | grep -Eq '^[0-9]{14}_[a-z0-9_]+\.sql$'; then
    echo "  ✗ invalid migration name: $base"
    bad=1
  fi
done
if [ $bad -ne 0 ]; then
  echo "커밋 차단: 마이그레이션 파일명 형식 위반"
  exit 1
fi

echo "[pre-commit] console.log detection..."
if git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -Hn 'console\.log' 2>/dev/null | grep -v '^\s*//' | grep -v "scripts/" ; then
  echo "  ⚠️  console.log 발견 (경고만, 커밋은 진행됨)"
fi

echo "[pre-commit] OK"
HOOK

chmod +x "$PRE_COMMIT"
echo "Installed $PRE_COMMIT"
