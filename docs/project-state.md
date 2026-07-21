# Project state

Last updated: 2026-07-20

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

The FRPC and FRPS service switches are shown under Common Settings while still
writing the `init.enabled` UCI option used by their init scripts. DDNS-Go
migrates the legacy `config` section and option names to the current `main`
service section so its LuCI enable switch controls startup correctly.

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

- Dashboard field for the main URLTest URL, next to the URLTest node selection.
- MIUI, HiCloud, Cloudflare, and Google `generate_204` presets.
- Custom HTTP/HTTPS URL validation.
- UCI default `https://www.gstatic.com/generate_204`.
- Generator mapping to the main sing-box URLTest outbound's `url` field.
- Simplified Chinese translations.

See `docs/homeproxy-upstreams.md` for the update policy.

On 2026-07-20, HomeProxy was synchronized to VIKINGYFY path commit
`2fc30e9ad5016a8c822656978e1d3ce1d42c91bf` together with sing-box
`1.14.0-alpha.48` at path commit
`a610a1d5913ec55b2b1d19f0c06716055814f313`. The update retains the local
main URLTest URL controls while adopting upstream URLTest cleanup and empty
group validation. The canonical shadcn theme commit was advanced to
`bd38f3616286a290346a3643ced80be8b13c2131`; that upstream delta only changes
development tooling, so no runtime theme files were imported.

## CI integration

- `ysuolmai/OpenWRT-CI` was switched to the collection in commit `6f0000d`.
- `ysuolmai/openwrt-ci2` uses `libwrt.sh` for several workflows and
  `diy-script.sh` for the remaining active workflows. Both use the collection.
  `diy-mini.sh` has no repository references and was intentionally left alone.
- `ysuolmai/amlogic-s9xxx-openwrt` has three source variants under
  `config/openwrt_main`, `config/immortalwrt_master`, and `config/lede_master`;
  all three use the collection and select the lightweight `moontvplus` service
  together with `luci-app-moontvplus`.
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
The LuCI core installer exposes one operation that installs or updates the
application core and optional subtitle font sequentially. The updater uses a
predictable `022` umask and repairs traversal permissions on the configured
core parent so the unprivileged `nobody` service can execute a freshly
downloaded runtime.

## Build verification

The remote ImmortalWrt IPQ60xx build verified these packages successfully:

- `ddns-go_6.17.1.1-r3_aarch64_cortex-a53.ipk`
- `luci-app-ddns-go_1.0.0-r2_all.ipk`
- `luci-app-adguardhome_0_all.ipk`
- `luci-theme-shadcn_0.3.1-r20260712_all.ipk`
- `luci-app-homeproxy_20260717-r3_all.ipk`
- `luci-i18n-homeproxy-zh-cn_20260717-r3_all.ipk`

The HomeProxy IPK was unpacked and checked for the URLTest field, default UCI
value, and generator mapping. The translation was converted successfully with
the OpenWrt `po2lmo` tool. Generated build output and logs were removed after
verification; staging toolchains and ccache were retained.

## Current repository delivery

## Package release workflow

- `.github/workflows/build-release.yml` automatically builds all packages as
  independent IPK matrix Jobs on pushes to `main`, and also supports manually
  building selected packages for the OpenWRT-CI `IPQ60XX-WIFI-YES`
  configuration (`qualcommax/ipq60xx`)
  using `VIKINGYFY/immortalwrt` `main`.
- Pushes trigger the complete IPK package matrix. The separate validation
  workflow remains an automatic check. Manual `all` runs build IPK by default;
  selecting `both` creates one Job per package and format.
- Before importing the collection, the workflow removes same-named packages
  installed from feeds or the source tree. This prevents feed versions from
  shadowing the locally maintained recipes.
- The workflow builds the target kernel before packages that depend on kernel
  modules. A failed build or missing primary IPK/APK output fails the run.
- Manual runs select one source package or all packages and choose IPK, APK, or
  both output formats. Every successful matrix Job uploads an Actions artifact;
  an all-package run aggregates package files into one Release. A successful
  build containing MoonTVPlus automatically updates the separate
  `moontvplus-core` Release with its core, optional font, and checksums.
- MoonTVPlus and its LuCI app use top-level `-j1` package builds without
  verbose `V=s` output. Their shared Node.js dependency can otherwise overwhelm
  the Actions log pipe during its highly parallel install phase; other packages
  retain the normal runner-wide parallel build.
- The workflow restores a stable OpenWrt host/toolchain cache and skips
  `make toolchain/install` on an exact cache hit. MoonTVPlus core Jobs also
  compile the target `node` package explicitly before `better-sqlite3`; Actions
  run `29734454128` showed that host Node tools alone do not stage the required
  target `common.gypi`, Node headers, or runtime binary on a clean runner.
- MoonTVPlus Jobs cache their host/target Node build dependencies separately,
  and use two workers only for the standalone target Node C++ build. Node uses
  concise output and retries once as a single-worker stamp verification if the
  parallel OpenWrt make returns nonzero after packaging and staging succeeded;
  this avoids multi-million-line Actions logs and preserves the verified cache.
  The MoonTVPlus pnpm/Next.js package build remains single-worker to avoid
  memory spikes and duplicate package-manager processes.
- The `moontvplus` recipe is lightweight by default: firmware builds package
  only the service, updater, and configuration files. The source checkout,
  target Node.js runtime, Node.js host tools, pnpm install, Next.js build, and
  native module build are enabled only when the dedicated core Job passes
  `MOONTVPLUS_BUILD_CORE=1`. The resulting core archive includes its matching
  target Node.js binary, so firmware builds do not compile or install Node.js.
- The dedicated `moontvplus-core` Release contains verified `2026.07.13-r10`
  cores for `aarch64_cortex-a53` and Amlogic's `aarch64_generic`, plus the
  optional JASSUB CJK font. The
  LuCI RPC uses ucode's global `trim()` for compatibility with the target rpcd,
  and fresh installs default the administrator credentials to `admin/admin`.

- Package consolidation commit: `14eee30` on `ysuolmai/openwrt-packages`.
- GitHub `Validate packages` completed successfully for that commit.
- `ysuolmai/openwrt-ci2`: source migration commit `fe5633a`.
- `ysuolmai/amlogic-s9xxx-openwrt`: source migration commit `6d0ad9c`, rebased
  after remote commit `bfd5c09` removed the superseded DDNS patch files;
  MoonTVPlus was enabled for all three source variants in commit `66b325e`.
- `ysuolmai/CloseWRT-CI`: source migration commit `d3c41e4`.

HomeProxy requires the matching maintained `sing-box` recipe. Consumer import
cleanup must remove the feed copy of `sing-box` before cloning this collection;
otherwise the older feed package can fail HomeProxy's minimum-version check.
This was verified and fixed in `openwrt-ci2` commit `1eb87fa`, all three
`amlogic-s9xxx-openwrt` source variants in commit `aa656bb`, and `CloseWRT-CI`
commit `10f89e7`. `OpenWRT-CI` already included `sing-box` in its conflict
cleanup list.
