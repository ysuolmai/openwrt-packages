# MoonTVPlus for OpenWrt

This package builds MoonTVPlus as a native procd-managed Node.js service. It
does not install or use Docker. The package itself contains only the service,
configuration and core updater. The application runtime is published as a
target-specific asset in the dedicated `moontvplus-core` GitHub Release and is
downloaded from LuCI on demand. Package collection releases contain only IPK
and APK files, so unrelated package updates do not change the core channel.

The runtime archive is checked against its SHA256 file, target architecture and
Node module ABI before activation. Its SQLite native module is loaded against an
in-memory database as a final preflight check. Core activation uses a versioned
directory and an atomic `current` symlink; a failed service restart restores the
previous link.

The three documentation screenshots are excluded from runtime archives. The
large JASSUB CJK fallback font is a separate optional download in LuCI. This
keeps the compressed core near 16 MiB while preserving advanced subtitle
support for users who install the font.

The default database is SQLite at `/etc/moontvplus/moontv.db`. For flash-based
devices, move `core_dir`, `data_dir` and `download_dir` to persistent external storage.
MoonTVPlus remains disabled until a non-empty administrator password is saved.

The OpenWrt build disables optional `sharp`-based manga cover compression to
avoid shipping libvips. Oversized covers are skipped by the existing fallback;
other manga functionality is unchanged.
