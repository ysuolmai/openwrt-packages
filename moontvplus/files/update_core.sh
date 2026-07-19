#!/bin/sh
# SPDX-License-Identifier: Apache-2.0

set -u

PATH=/usr/sbin:/usr/bin:/sbin:/bin
RUN_DIR=/var/run/moontvplus
LOCK_DIR="$RUN_DIR/core-update.lock"
RESULT_FILE="$RUN_DIR/core-update.result"
LOG_TAG=moontvplus-update

cfg() {
	uci -q get "moontvplus.main.$1"
}

fail() {
	echo "$1"
	exit 1
}

valid_path() {
	case "$1" in
		/*) return 0;;
		*) return 1;;
	esac
}

release_urls() {
	jsonfilter -i "$1" -e '@.assets[*].browser_download_url'
}

find_asset_url() {
	local metadata="$1"
	local pattern="$2"
	local url
	release_urls "$metadata" | while IFS= read -r url; do
		case "$url" in
			https://github.com/*/releases/download/*/$pattern) printf '%s\n' "$url"; break;;
		esac
	done
}

download_asset() {
	local url="$1"
	local output="$2"
	curl --fail --location --silent --show-error \
		--proto '=https' --tlsv1.2 --retry 2 --connect-timeout 20 --max-time 1800 \
		-o "$output" "$url"
}

verify_checksum() {
	local payload="$1"
	local checksum_file="$2"
	local filename expected actual
	filename="${payload##*/}"
	expected="$(awk -v name="$filename" '$2 == name || $2 == "*" name { print $1; exit }' "$checksum_file")"
	case "$expected" in
		[0-9a-fA-F][0-9a-fA-F]*) ;;
		*) fail "Checksum file does not contain $filename.";;
	esac
	[ "${#expected}" -eq 64 ] || fail "Invalid SHA256 length for $filename."
	actual="$(sha256sum "$payload" | awk '{ print $1 }')"
	[ "$actual" = "$expected" ] || fail "SHA256 verification failed for $filename."
	printf '%s\n' "$actual"
}

link_optional_font() {
	local candidate="$1"
	local shared_font="$core_dir/shared/NotoSansCJK-Regular.ttc"
	local target="$candidate/public/assets/jassub/NotoSansCJK-Regular.ttc"
	[ -s "$shared_font" ] || return 0
	mkdir -p "${target%/*}"
	ln -sf "$shared_font" "$target"
}

validate_links() {
	local candidate="$1"
	local link resolved
	find "$candidate" -type l -print | while IFS= read -r link; do
		resolved="$(readlink -f "$link" 2>/dev/null || true)"
		case "$resolved" in
			"$candidate"/*) ;;
			"$core_dir/shared"/*) ;;
			*) echo "$link" >"$work_dir/unsafe-link"; break;;
		esac
	done
	[ ! -e "$work_dir/unsafe-link" ] || fail "Core archive contains an unsafe symbolic link."
}

install_core() {
	local metadata="$1"
	local arch="$2"
	local force="$3"
	local url checksum_url archive checksum_file checksum marker_version marker_arch marker_abi
	local runtime_abi target old_link new_link candidate list node_bin
	url="$(find_asset_url "$metadata" "moontvplus-core_*_${arch}.tar.gz")"
	[ -n "$url" ] || fail "No MoonTVPlus core is available for architecture $arch."
	checksum_url="$url.sha256"
	archive="$work_dir/${url##*/}"
	checksum_file="$archive.sha256"

	if [ "$force" != force ] && [ -f "$core_dir/current/.moontvplus-source" ] && \
		[ "$(sed -n 's/^url=//p' "$core_dir/current/.moontvplus-source")" = "$url" ]; then
		echo "The latest core is already installed."
		return 0
	fi

	echo "Downloading ${url##*/}"
	download_asset "$url" "$archive"
	download_asset "$checksum_url" "$checksum_file"
	checksum="$(verify_checksum "$archive" "$checksum_file")"

	list="$work_dir/archive.list"
	tar -tzf "$archive" >"$list" || fail "Unable to read the core archive."
	grep -qx 'moontvplus/start.js' "$list" || fail "Core archive does not contain moontvplus/start.js."
	if grep -Eq '(^/|(^|/)\.\.(/|$))' "$list"; then
		fail "Core archive contains an unsafe path."
	fi
	if grep -Ev '^moontvplus(/|$)' "$list" | grep -q .; then
		fail "Core archive contains an unexpected top-level path."
	fi

	mkdir -p "$work_dir/extract"
	tar -xzf "$archive" -C "$work_dir/extract"
	candidate="$work_dir/extract/moontvplus"
	[ -s "$candidate/.moontvplus-core" ] || fail "Core metadata is missing."
	node_bin="$candidate/node"
	[ -x "$node_bin" ] || fail "Core Node runtime is missing."
	marker_version="$(sed -n 's/^version=//p' "$candidate/.moontvplus-core")"
	marker_arch="$(sed -n 's/^arch=//p' "$candidate/.moontvplus-core")"
	marker_abi="$(sed -n 's/^node_module_version=//p' "$candidate/.moontvplus-core")"
	case "$marker_version" in *[!A-Za-z0-9._-]*|'') fail "Core version is invalid.";; esac
	[ "$marker_arch" = "$arch" ] || fail "Core architecture does not match this package."
	runtime_abi="$("$node_bin" -p 'process.versions.modules' 2>/dev/null || true)"
	[ "$marker_abi" = "$runtime_abi" ] || \
		fail "Core requires Node module ABI $marker_abi, but the installed Node provides $runtime_abi."
	link_optional_font "$candidate"
	validate_links "$candidate"
	(
		cd "$candidate" || exit 1
		./node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close()"
	) >/dev/null 2>&1 || fail "The downloaded SQLite module failed its runtime check."
	printf 'url=%s\nsha256=%s\n' "$url" "$checksum" >"$candidate/.moontvplus-source"

	target="$marker_version-$(printf '%s' "$checksum" | cut -c1-12)"
	mkdir -p "$core_dir/versions"
	[ ! -e "$core_dir/versions/$target" ] || target="$target-$$"
	mv "$candidate" "$core_dir/versions/$target"
	old_link="$(readlink "$core_dir/current" 2>/dev/null || true)"
	new_link="$core_dir/.current.$$"
	ln -s "versions/$target" "$new_link"
	mv -f "$new_link" "$core_dir/current"

	if /etc/init.d/moontvplus running >/dev/null 2>&1; then
		/etc/init.d/moontvplus restart >/dev/null 2>&1 || true
		sleep 3
		if ! /etc/init.d/moontvplus running >/dev/null 2>&1; then
			rm -f "$core_dir/current"
			[ -n "$old_link" ] && ln -s "$old_link" "$core_dir/current"
			/etc/init.d/moontvplus start >/dev/null 2>&1 || true
			fail "The new core failed to restart; the previous core was restored."
		fi
	fi
	echo "Installed MoonTVPlus core $marker_version for $marker_arch."
}

install_font() {
	local metadata="$1"
	local force="$2"
	local url checksum_url payload checksum_file checksum current
	url="$(find_asset_url "$metadata" 'moontvplus-jassub-font_*.ttc')"
	[ -n "$url" ] || fail "No optional JASSUB font asset is available."
	current="$core_dir/shared/.font-source"
	if [ "$force" != force ] && [ -f "$current" ] && \
		[ "$(sed -n 's/^url=//p' "$current")" = "$url" ]; then
		echo "The latest optional font is already installed."
		return 0
	fi
	payload="$work_dir/${url##*/}"
	checksum_url="$url.sha256"
	checksum_file="$payload.sha256"
	echo "Downloading ${url##*/}"
	download_asset "$url" "$payload"
	download_asset "$checksum_url" "$checksum_file"
	checksum="$(verify_checksum "$payload" "$checksum_file")"
	[ -s "$payload" ] || fail "The downloaded font is empty."
	mkdir -p "$core_dir/shared"
	mv "$payload" "$core_dir/shared/NotoSansCJK-Regular.ttc.new"
	mv -f "$core_dir/shared/NotoSansCJK-Regular.ttc.new" \
		"$core_dir/shared/NotoSansCJK-Regular.ttc"
	printf 'url=%s\nsha256=%s\n' "$url" "$checksum" >"$current"
	[ ! -d "$core_dir/current" ] || link_optional_font "$core_dir/current"
	echo "Installed the optional JASSUB CJK font."
}

component="${1:-core}"
force="${2:-}"
case "$component" in core|font) ;; *) fail "Usage: $0 {core|font} [force]";; esac
core_dir="$(cfg core_dir)"; [ -n "$core_dir" ] || core_dir=/mnt/moontvplus/core
release_repo="$(cfg release_repo)"; [ -n "$release_repo" ] || release_repo=ysuolmai/openwrt-packages
release_tag="$(cfg release_tag)"; [ -n "$release_tag" ] || release_tag=moontvplus-core
valid_path "$core_dir" || fail "Core directory must be an absolute path."
case "$core_dir" in
	/|*[!A-Za-z0-9_./+-]*) fail "Core directory contains unsupported characters.";;
esac
case "$release_repo" in
	/*|*/|*/*/*|*[!A-Za-z0-9_./-]*) fail "Release repository is invalid.";;
	*/*) ;;
	*) fail "Release repository must use the owner/repository form.";;
esac
case "$release_tag" in
	''|*[!A-Za-z0-9._-]*) fail "Release tag is invalid.";;
esac

mkdir -p "$RUN_DIR" "$core_dir"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
	fail "Another core update is already running."
fi
work_dir="$core_dir/.update.$$"
cleanup() {
	rc=$?
	rm -rf "$work_dir" "$LOCK_DIR"
	if [ "$rc" -eq 0 ]; then echo success >"$RESULT_FILE"; else echo failed >"$RESULT_FILE"; fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
mkdir -p "$work_dir"
echo running >"$RESULT_FILE"

metadata="$work_dir/release.json"
api="https://api.github.com/repos/$release_repo/releases/tags/$release_tag"
echo "Checking release $release_tag in $release_repo."
download_asset "$api" "$metadata"
arch="$(sed -n '1p' /usr/share/moontvplus/core-arch)"
[ -n "$arch" ] || fail "The package does not declare its target architecture."

if [ "$component" = core ]; then
	install_core "$metadata" "$arch" "$force"
else
	install_font "$metadata" "$force"
fi
logger -t "$LOG_TAG" "$component update completed"
