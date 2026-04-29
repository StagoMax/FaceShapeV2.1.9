#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

usage() {
  cat <<'EOF'
Usage: switch-codex.sh <profile>

Profiles are stored under ~/.codex-profiles/<profile>/ with:
  - auth.json
  - config.toml

Shared data lives under ~/.codex-profiles/shared/.codex/ and is symlinked
into the project .codex directory so sessions/skills/history stay in sync.

Example:
  switch-codex.sh api
  switch-codex.sh account
EOF
}

profile="${1:-}"
if [[ -z "$profile" || "$profile" == "-h" || "$profile" == "--help" ]]; then
  usage
  exit 0
fi

base_dir="${CODEX_PROFILES_DIR:-$HOME/.codex-profiles}"

# Resolve the script's real path to maintain project_root when a symlink is used
source="${BASH_SOURCE[0]}"
while [[ -h "$source" ]]; do
  dir="$(cd -P "$(dirname "$source")" && pwd)"
  source="$(readlink "$source")"
  [[ "$source" != /* ]] && source="$dir/$source"
done
project_root="$(cd "$(dirname "$source")/.." && pwd)"
shared_dir="$base_dir/shared/.codex"
profile_dir="$base_dir/$profile"

if [[ ! -f "$profile_dir/auth.json" || ! -f "$profile_dir/config.toml" ]]; then
  mkdir -p "$profile_dir"
  touch "$profile_dir/auth.json" "$profile_dir/config.toml"
fi

mkdir -p "$shared_dir"
chmod 700 "$base_dir" "${base_dir}/shared" "$shared_dir" "$profile_dir" 2>/dev/null || true
chmod 600 "$profile_dir/auth.json" "$profile_dir/config.toml" 2>/dev/null || true

if [[ ! -d "$shared_dir" || -z "$(ls -A "$shared_dir" 2>/dev/null)" ]]; then
  if [[ -d "$project_root/.codex" ]]; then
    cp -a "$project_root/.codex/." "$shared_dir/"
    rm -f "$shared_dir/auth.json" "$shared_dir/config.toml"

    find "$shared_dir" -maxdepth 2 -type f \
      \( -iname "*auth*" -o -iname "*token*" -o -iname "*session*" -o -iname "*credential*" \) \
      -print 2>/dev/null || true
  fi
fi

rm -rf -- "$project_root/.codex"
mkdir -p "$project_root/.codex"

shopt -s dotglob nullglob
for item in "$shared_dir"/*; do
  ln -sfn "$item" "$project_root/.codex/$(basename "$item")"
done
shopt -u dotglob nullglob

ln -sfn "$profile_dir/auth.json" "$project_root/.codex/auth.json"
ln -sfn "$profile_dir/config.toml" "$project_root/.codex/config.toml"

echo "Switched to profile '$profile'."
