# Project state

Last updated: 2026-07-17

## Purpose

`ysuolmai/openwrt-packages` is the single repository for self-maintained
OpenWrt packages. CI repositories clone the collection once and remove any
conflicting feed or third-party copies first.

## Packages

The collection currently owns:

- `frp`
- `luci-app-frpc`
- `luci-app-frps`
- `ddns-go`
- `luci-app-ddns-go`
- `luci-app-adguardhome`
- `luci-theme-shadcn`
- `luci-app-homeproxy`
- `moontvplus`
- `luci-app-moontvplus`

Detailed upstream commits and local changes are stored in `upstreams.json`.
The standalone `ysuolmai` repositories remain available as history but are no
longer the package source used by CI.

## HomeProxy decision

HomeProxy uses the VIKINGYFY implementation rather than the previous
`ysuolmai/homeproxy` fork. This is a substantial rewrite based on a newer
sing-box architecture, not a small patch over ImmortalWrt HomeProxy.

The local delta is intentionally narrow:

- Dashboard field for the main URLTest URL.
- MIUI, HiCloud, Cloudflare, and Google `generate_204` presets.
- Custom HTTP/HTTPS URL validation.
- UCI default `https://www.gstatic.com/generate_204`.
- Generator mapping to the main sing-box URLTest outbound's `url` field.
- Simplified Chinese translations.

See `docs/homeproxy-upstreams.md` for the update policy.

## CI integration

- `ysuolmai/OpenWRT-CI` was switched to the collection in commit `6f0000d`.
- `ysuolmai/openwrt-ci2` uses `libwrt.sh` for several workflows and
  `diy-script.sh` for the remaining active workflows. Both use the collection.
  `diy-mini.sh` has no repository references and was intentionally left alone.
- `ysuolmai/amlogic-s9xxx-openwrt` has three source variants under
  `config/openwrt_main`, `config/immortalwrt_master`, and `config/lede_master`;
  all three must use the collection.
- `ysuolmai/CloseWRT-CI` runs `Scripts/Packages.sh`, then `Scripts/Handles.sh`,
  then `Scripts/diy.sh`. The collection is installed in `diy.sh`. The old
  HomeProxy resource preloader is incompatible with the VIKINGYFY layout and
  must remain removed.

Do not let later `jell` imports overwrite `frp`, DDNS-Go, or their LuCI apps.
The VIKINGYFY package bundle may contain another HomeProxy copy; conflict
cleanup before cloning this collection must remove it.

MoonTVPlus is built from a pinned upstream commit as a native Node.js 24
standalone application. It runs under procd without Docker. The service package
cross-compiles `better-sqlite3` for the OpenWrt target and omits optional
`sharp`-based manga cover compression. `luci-app-moontvplus` owns its UCI,
service control and log interface.

## Build verification

The remote ImmortalWrt IPQ60xx build verified these packages successfully:

- `ddns-go_6.17.1.1-r3_aarch64_cortex-a53.ipk`
- `luci-app-ddns-go_1.0.0-r2_all.ipk`
- `luci-app-adguardhome_0_all.ipk`
- `luci-theme-shadcn_0.3.1-r20260712_all.ipk`
- `luci-app-homeproxy_20260717-r3_all.ipk`
- `luci-i18n-homeproxy-zh-cn_20260717-r3_all.ipk`

The HomeProxy IPK was unpacked and checked for the Dashboard field, default UCI
value, and generator mapping. The translation was converted successfully with
the OpenWrt `po2lmo` tool. Generated build output and logs were removed after
verification; staging toolchains and ccache were retained.

## Current repository delivery

- Package consolidation commit: `14eee30` on `ysuolmai/openwrt-packages`.
- GitHub `Validate packages` completed successfully for that commit.
- `ysuolmai/openwrt-ci2`: source migration commit `fe5633a`.
- `ysuolmai/amlogic-s9xxx-openwrt`: source migration commit `6d0ad9c`, rebased
  after remote commit `bfd5c09` removed the superseded DDNS patch files.
- `ysuolmai/CloseWRT-CI`: source migration commit `d3c41e4`.
