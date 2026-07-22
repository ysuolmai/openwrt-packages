#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
MANIFEST="$ROOT_DIR/upstreams.json"

command -v jq >/dev/null 2>&1 || {
	echo "error: jq is required" >&2
	exit 1
}
command -v curl >/dev/null 2>&1 || {
	echo "error: curl is required" >&2
	exit 1
}

jq -c '
	.packages[].upstreams[] |
	select(.commit != null) |
	{ repository, branch, path, commit, tracking, version }
' "$MANIFEST" | sort -u | while IFS= read -r upstream; do
	repository="$(printf '%s' "$upstream" | jq -r '.repository')"
	branch="$(printf '%s' "$upstream" | jq -r '.branch')"
	path="$(printf '%s' "$upstream" | jq -r '.path')"
	recorded="$(printf '%s' "$upstream" | jq -r '.commit')"
	tracking="$(printf '%s' "$upstream" | jq -r '.tracking // empty')"
	version="$(printf '%s' "$upstream" | jq -r '.version // empty')"
	slug="${repository#https://github.com/}"
	label="$branch"
	if [ "$tracking" = releases ] && [ -n "$version" ] && [ -z "$path" ]; then
		latest="$(git ls-remote "$repository.git" "refs/tags/$version^{}" |
			awk 'NR == 1 { print $1 }')"
		[ -n "$latest" ] || latest="$(git ls-remote "$repository.git" "refs/tags/$version" |
			awk 'NR == 1 { print $1 }')"
		label="$version"
	elif [ -n "$path" ]; then
		latest="$(curl -fsSLG \
			--data-urlencode "sha=$branch" \
			--data-urlencode "path=$path" \
			--data-urlencode "per_page=1" \
			"https://api.github.com/repos/$slug/commits" |
			jq -r '.[0].sha // empty')"
	else
		latest="$(git ls-remote "$repository.git" "refs/heads/$branch" | awk 'NR == 1 { print $1 }')"
	fi
	if [ -z "$latest" ]; then
		echo "ERROR    $repository/$path ($label): upstream not found"
	elif [ "$latest" = "$recorded" ]; then
		echo "CURRENT  $repository/$path ($label): $recorded"
	else
		echo "UPDATE   $repository/$path ($label): $recorded -> $latest"
	fi
done
