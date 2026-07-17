#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
MANIFEST="$ROOT_DIR/upstreams.json"

command -v jq >/dev/null 2>&1 || {
	echo "error: jq is required" >&2
	exit 1
}

jq -r '
	.packages[].upstreams[] |
	select(.commit != null) |
	[.repository, .branch, .commit] | @tsv
' "$MANIFEST" | sort -u | while IFS="	" read -r repository branch recorded; do
	latest="$(git ls-remote "$repository.git" "refs/heads/$branch" | awk 'NR == 1 { print $1 }')"
	if [ -z "$latest" ]; then
		echo "ERROR    $repository ($branch): branch not found"
	elif [ "$latest" = "$recorded" ]; then
		echo "CURRENT  $repository ($branch): $recorded"
	else
		echo "UPDATE   $repository ($branch): $recorded -> $latest"
	fi
done
