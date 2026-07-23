# OpenWrt Packages

Self-maintained OpenWrt packages used by
[ysuolmai/OpenWRT-CI](https://github.com/ysuolmai/OpenWRT-CI).

## Packages

| Package | Upstream | Local purpose |
| --- | --- | --- |
| `frp` | [`fatedier/frp`](https://github.com/fatedier/frp) | Combined client/server services with verified official core updates |
| `luci-app-frp` | [`immortalwrt/luci`](https://github.com/immortalwrt/luci/tree/master/applications/luci-app-frpc) | Client/server tabs with shared core management |
| `ddns-go` | [`jeessy2/ddns-go`](https://github.com/jeessy2/ddns-go) | Router-specific DDNS engine with embedded source |
| `luci-app-ddns-go` | [`sirpdboy/luci-app-ddns-go`](https://github.com/sirpdboy/luci-app-ddns-go) | Native LuCI management for the router DDNS engine |
| `luci-app-adguardhome` | [AdGuard Home](https://github.com/AdguardTeam/AdGuardHome) | LuCI integration, service management and core updates |
| `luci-theme-shadcn` | [`eamonxg/luci-theme-shadcn`](https://github.com/eamonxg/luci-theme-shadcn) | Self-maintained shadcn-style LuCI theme |
| `sing-box` | [`VIKINGYFY/packages`](https://github.com/VIKINGYFY/packages/tree/main/sing-box) | Runtime version paired with the maintained HomeProxy architecture |
| `luci-app-homeproxy` | [`VIKINGYFY/packages`](https://github.com/VIKINGYFY/packages/tree/main/luci-app-homeproxy) | Performance-oriented HomeProxy with configurable main URLTest URL |
| `moontvplus` | [`ysuolmai/MoonTVPlus`](https://github.com/ysuolmai/MoonTVPlus) | Native Node.js service managed by procd without Docker |
| `luci-app-moontvplus` | [`ysuolmai/MoonTVPlus`](https://github.com/ysuolmai/MoonTVPlus) | LuCI configuration, service control and log viewing for MoonTVPlus |

The machine-readable source of truth is [`upstreams.json`](upstreams.json). It
records every package's upstream repository, branch, source path, latest
path-specific commit, synchronization strategy, and local changes.

The HomeProxy upstream comparison and synchronization policy are documented in
[`docs/homeproxy-upstreams.md`](docs/homeproxy-upstreams.md).
Persistent project context for future maintenance sessions is in
[`docs/project-state.md`](docs/project-state.md).

## Updating

Check whether tracked upstream branches have moved:

```sh
./scripts/check-upstreams.sh
```

After reviewing and porting upstream changes, update the corresponding commit in
`upstreams.json` and run:

```sh
./scripts/validate.sh
```

## OpenWrt integration

Clone the whole repository below the buildroot's `package/` directory. OpenWrt
discovers each package recursively:

```sh
git clone --depth=1 https://github.com/ysuolmai/openwrt-packages.git \
	package/ysuolmai-packages
```
