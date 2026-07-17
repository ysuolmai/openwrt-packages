# MoonTVPlus for OpenWrt

This package builds MoonTVPlus as a native procd-managed Node.js service. It
does not install or use Docker.

The default database is SQLite at `/etc/moontvplus/moontv.db`. For flash-based
devices, move `data_dir` and `download_dir` to persistent external storage.
MoonTVPlus remains disabled until a non-empty administrator password is saved.

The OpenWrt build disables optional `sharp`-based manga cover compression to
avoid shipping libvips. Oversized covers are skipped by the existing fallback;
other manga functionality is unchanged.
