#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
MANIFEST="$ROOT_DIR/upstreams.json"

jq -e '
	.schema_version == 1 and
	(.packages | type == "array" and length > 0) and
	all(.packages[];
		(.name | type == "string" and length > 0) and
		(.path | type == "string" and length > 0) and
		(.upstreams | type == "array" and length > 0) and
		all(.upstreams[];
			(.repository | startswith("https://github.com/")) and
			(.branch | type == "string" and length > 0) and
			(.path | type == "string")
		)
	)
' "$MANIFEST" >/dev/null

jq -r '.packages[] | [.name, .path] | @tsv' "$MANIFEST" |
while IFS="	" read -r package path; do
	[ -f "$ROOT_DIR/$path/Makefile" ] || {
		echo "error: $package has no Makefile at $path/Makefile" >&2
		exit 1
	}
done

package_paths="$(jq -r '.packages[].path' "$MANIFEST")"

for path in $package_paths; do
	find "$ROOT_DIR/$path" -type f | while IFS= read -r file; do
		first_line="$(sed -n '1p' "$file")"
		case "$first_line" in
		'#!'*'/bin/sh'*) sh -n "$file" ;;
		esac
	done

	find "$ROOT_DIR/$path" -type f -name '*.json' -exec jq -e . {} \; >/dev/null

	if [ -d "$ROOT_DIR/$path/htdocs" ]; then
		find "$ROOT_DIR/$path/htdocs" -type f -name '*.js' | while IFS= read -r file; do
			node --check "$file"
		done
	fi
done

echo "Package metadata, shell scripts, JSON and LuCI JavaScript are valid."
