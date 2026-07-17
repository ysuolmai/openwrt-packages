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

for init in "$ROOT_DIR"/frp/files/*.init; do
	sh -n "$init"
done

echo "Package metadata and shell scripts are valid."
