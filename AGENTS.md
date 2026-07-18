# Project Instructions

This repository is the single collection for OpenWrt packages maintained by
`ysuolmai`. Do not split packages back into separate repositories or add a new
standalone package repository unless the user explicitly requests it.

## Sources and updates

- Treat `upstreams.json` as the source of truth for upstream repository,
  branch, path, recorded commit, synchronization strategy, and local patches.
- Run `./scripts/check-upstreams.sh` before updating an imported package.
- Preserve package-specific local changes listed in `upstreams.json`.
- Keep the previous standalone repositories as historical references. Do not
  delete or archive them unless explicitly requested.
- Do not import standard OpenWrt packages such as `docker` and `dockerd` unless
  this repository needs durable local patches that cannot remain in CI.

## HomeProxy

- Use `VIKINGYFY/packages/luci-app-homeproxy` as the primary upstream.
- Mirror `VIKINGYFY/packages/sing-box` with HomeProxy and update them as a
  compatible pair.
- Preserve the configurable main URLTest URL on the Dashboard tab, its HTTP(S)
  validation, presets, UCI default, Chinese translation, and sing-box generator
  mapping.
- Consult `docs/homeproxy-upstreams.md` before rebasing HomeProxy.

## CI consumers

Keep these repositories pointed at this collection for the packages it owns:

- `ysuolmai/OpenWRT-CI`
- `ysuolmai/openwrt-ci2`
- `ysuolmai/amlogic-s9xxx-openwrt`
- `ysuolmai/CloseWRT-CI`

Remove conflicting feed and third-party copies before cloning this repository.
FRP must not subsequently be overwritten by `kenzok8/jell` because the local
version carries the service switches and defaults both services to disabled.

## Validation and build host

- Run `./scripts/validate.sh`, upstream checks, relevant shell syntax checks,
  and `git diff --check`.
- Use the reusable Ubuntu build host at `root@172.28.1.1:7008`; fallback address
  is `root@192.168.193.129:22`.
- SSH with `~/.codex/ssh/codex_control_ed25519`.
- The reusable ImmortalWrt IPQ60xx tree is
  `/home/runner/wrt-cache/qualcommax/wrt`. Run builds as user `runner`.
- If Go downloads through the default proxy time out, use
  `GOPROXY=https://goproxy.cn,direct`.
- Retain source trees, downloads, staging toolchains, and ccache. After testing,
  remove generated IPKs/images, package build directories, temporary files,
  and task-specific logs.
- Do not reinstall a GitHub Actions runner on the build host.

## Delivery

Commit and push validated changes to each affected repository. Record material
state changes in `docs/project-state.md` so a future resume can continue from
this directory without relying on chat history.
