#!/usr/bin/env bash
#
# WoCow — create the five-branch layout on a fresh clone (macOS / Linux).
#
#   bash scripts/setup-branches.sh          # create the branches locally
#   bash scripts/setup-branches.sh --push   # and push them to origin
#
# Idempotent: existing branches are left alone. Never deletes or resets.

set -euo pipefail

MAIN_BRANCH="${MAIN_BRANCH:-main}"
PUSH=0

for arg in "$@"; do
  case "$arg" in
    --push) PUSH=1 ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

BRANCHES=(
  "feature/frontend:Person 1:UI / 界面"
  "feature/map:Person 2:地图"
  "feature/backend:Person 3:数据库与活动"
  "feature/matching:Person 4:匹配算法"
  "feature/integration:Person 5:集成与测试"
)

if ! command -v git >/dev/null 2>&1; then
  echo "Git was not found. Install it from https://git-scm.com/downloads" >&2
  exit 1
fi

# Always operate from the repository root, wherever this is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

echo "Repository: $REPO_ROOT"
echo

# --- initialise if needed -----------------------------------------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "No Git repository here — running git init."
  git init -b "$MAIN_BRANCH" >/dev/null
fi

# --- a branch needs at least one commit ---------------------------------------
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  cat >&2 <<'EOF'
There is no commit yet, so there is nothing for a branch to point at.
Make the first commit, then run this script again:

    git add .
    git commit -m "Initialize WoCow React application"
EOF
  exit 1
fi

# --- start from main ----------------------------------------------------------
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT" != "$MAIN_BRANCH" ]; then
  if ! git switch "$MAIN_BRANCH" >/dev/null 2>&1; then
    echo "Could not switch to '$MAIN_BRANCH' (currently on '$CURRENT')." >&2
    echo "Resolve that first — there may be uncommitted changes." >&2
    exit 1
  fi
fi

# --- create the branches ------------------------------------------------------
created=0
existing=0

printf '%-24s %-10s %-16s %s\n' 'BRANCH' 'OWNER' 'AREA' 'STATUS'
printf '%-24s %-10s %-16s %s\n' '------' '-----' '----' '------'

for entry in "${BRANCHES[@]}"; do
  IFS=':' read -r name owner area <<< "$entry"

  if git show-ref --verify --quiet "refs/heads/$name"; then
    status='already existed'
    existing=$((existing + 1))
  else
    git branch "$name" >/dev/null
    status='created'
    created=$((created + 1))
  fi

  printf '%-24s %-10s %-16s %s\n' "$name" "$owner" "$area" "$status"
done

echo

# --- optionally publish them --------------------------------------------------
if [ "$PUSH" -eq 1 ]; then
  echo "Pushing branches to origin…"
  for entry in "${BRANCHES[@]}"; do
    IFS=':' read -r name _ _ <<< "$entry"
    if git push -u origin "$name" >/dev/null 2>&1; then
      echo "  pushed $name"
    else
      echo "  could not push $name — is 'origin' set up?" >&2
    fi
  done
  echo
fi

echo "Done. Created $created, already present $existing."
echo
echo "Next, each person gets on their own branch:"
echo "    git switch feature/matching"
echo
echo "See docs/GIT_WORKFLOW.md for the daily loop."
