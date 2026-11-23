#!/usr/bin/env bash
# Install or upgrade the @cdlab appshell registry (https://github.com/wuchendi/appshell)
# into packages/ui/src/shell, shared by every app as `@cdlab/ui/shell/...`.
#
#   bash ./scripts/appshell-sync.sh                       # default items
#   bash ./scripts/appshell-sync.sh @cdlab/shell-menus    # specific items
#
# shadcn cannot do this unattended on its own in this monorepo, so the script
# wraps it:
#   - without --overwrite it prompts for every differing file and, with no
#     terminal, writes nothing; with --overwrite it also replaces our shared UI
#     components, so those (and package.json / the lockfile) are restored after;
#   - it does not rewrite `@/components/ui/*` and `@/shell/*` for a workspace
#     package, so the imports are rewritten here;
#   - it appends registry CSS (keyframes) to globals.css unformatted; that file
#     is restored too and the CSS it wanted to add is printed for a manual merge.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI="packages/ui"
cd "$ROOT"

ITEMS=("$@")
[ ${#ITEMS[@]} -eq 0 ] && ITEMS=(@cdlab/shell-router-next @cdlab/shell-layout)

RESTORE=("$UI/src/components" "$UI/src/styles/globals.css" "$UI/package.json" pnpm-lock.yaml)
if ! git diff --quiet -- "${RESTORE[@]}"; then
  echo "Commit or stash changes in ${RESTORE[*]} first; they are restored after shadcn." >&2
  exit 1
fi

SHADCN_VERSION="$(grep -E '^\s+shadcn:' pnpm-workspace.yaml | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
(cd "$UI" && pnpm dlx "shadcn@${SHADCN_VERSION}" add "${ITEMS[@]}" --overwrite --yes)

css_diff="$(git diff -- "$UI/src/styles/globals.css")"
git checkout -- "${RESTORE[@]}"

grep -rlE '"@/(components/ui|shell)/' "$UI/src/shell" | xargs -r sed -i \
  -e 's#"@/components/ui/#"@cdlab/ui/components/#g' \
  -e 's#"@/shell/#"@cdlab/ui/shell/#g'

if [ -n "$css_diff" ]; then
  echo
  echo "The registry wanted to add this CSS to $UI/src/styles/globals.css (restored);"
  echo "merge anything new by hand:"
  echo "$css_diff" | grep '^+' | grep -v '^+++'
fi
echo
echo "Done. Check \`git status $UI/src/shell\`, new npm dependencies of the items"
echo "(add them to $UI/package.json via the catalog), then build an app that uses the shell."
