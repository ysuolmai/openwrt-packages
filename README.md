# OpenWrt Packages

Self-maintained OpenWrt packages used by
[ysuolmai/OpenWRT-CI](https://github.com/ysuolmai/OpenWRT-CI).

## Packages

| Package | Upstream | Local purpose |
| --- | --- | --- |
| `frp` | [`kenzok8/jell`](https://github.com/kenzok8/jell/tree/main/frp) | Install and control the `frpc` and `frps` services; disabled by default |
| `luci-app-frpc` | [`immortalwrt/luci`](https://github.com/immortalwrt/luci/tree/master/applications/luci-app-frpc) | LuCI client configuration with a service switch |
| `luci-app-frps` | [`immortalwrt/luci`](https://github.com/immortalwrt/luci/tree/master/applications/luci-app-frps) | LuCI server configuration with a service switch |

The machine-readable source of truth is [`upstreams.json`](upstreams.json). It
records every package's upstream repository, branch, source path, synchronized
commit, synchronization strategy, and local changes.

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
