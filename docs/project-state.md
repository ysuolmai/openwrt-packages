# Project state

Last updated: 2026-07-19

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
- `sing-box`
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

The VIKINGYFY sing-box recipe is mirrored in this collection as a required
companion package. CI consumers must not pair this HomeProxy with the older
ImmortalWrt packages feed recipe.

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
The VIKINGYFY package bundle and standard feeds may contain other HomeProxy or
sing-box copies; conflict cleanup before cloning this collection must remove
both.

MoonTVPlus is built from a pinned upstream commit as a native Node.js 24
standalone application. It runs under procd without Docker. The service package
cross-compiles `better-sqlite3` for the OpenWrt target and omits optional
`sharp`-based manga cover compression. Host x86-64 ELF files pulled into the
Next.js standalone dependency tree are removed before OpenWrt dependency
scanning and packaging. The shell positional parameter in this removal command
must use `$$$$1` in the package Makefile because `BuildPackage` and the final
recipe each consume one level of dollar escaping. GitHub Actions run
`29645660124` exposed the previous `$$1` form as `file ""`, leaving host ELF
files in the package and causing false glibc dependency errors.
`luci-app-moontvplus` owns its UCI, service control and log interface.

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

## Package release workflow

- `.github/workflows/build-release.yml` manually builds selected packages in
  an independent matrix Job for the OpenWRT-CI `IPQ60XX-WIFI-YES`
  configuration (`qualcommax/ipq60xx`)
  using `VIKINGYFY/immortalwrt` `main`.
- Pushes do not trigger package compilation. The separate validation workflow
  remains the required automatic check. Manual `all` runs build IPK by default;
  selecting `both` creates one Job per package and format, avoiding the former
  all-package six-hour Job limit.
- Before importing the collection, the workflow removes same-named packages
  installed from feeds or the source tree. This prevents feed versions from
  shadowing the locally maintained recipes.
- The workflow builds the target kernel before packages that depend on kernel
  modules. A failed build or missing primary IPK/APK output fails the run.
- Manual runs select one source package or all packages and choose IPK, APK, or
  both output formats. Every successful matrix Job uploads an Actions artifact;
  an all-package run aggregates package files into one Release. MoonTVPlus core,
  optional font, and checksums remain in the separate `moontvplus-core` Release.
- MoonTVPlus and its LuCI app use top-level `-j1` package builds without
  verbose `V=s` output. Their shared Node.js dependency can otherwise overwhelm
  the Actions log pipe during its highly parallel install phase; other packages
  retain the normal runner-wide parallel build.

- Package consolidation commit: `14eee30` on `ysuolmai/openwrt-packages`.
- GitHub `Validate packages` completed successfully for that commit.
- `ysuolmai/openwrt-ci2`: source migration commit `fe5633a`.
- `ysuolmai/amlogic-s9xxx-openwrt`: source migration commit `6d0ad9c`, rebased
  after remote commit `bfd5c09` removed the superseded DDNS patch files.
- `ysuolmai/CloseWRT-CI`: source migration commit `d3c41e4`.
