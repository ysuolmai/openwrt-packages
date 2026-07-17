# HomeProxy upstream policy

The package uses `VIKINGYFY/packages/luci-app-homeproxy` as its primary
upstream. This version was selected for its newer sing-box 1.14 architecture,
dashboard integration, runtime port allocation, and streamlined GeoSite/GeoIP
routing resources.

Two other source lines remain tracked for comparison:

- `immortalwrt/homeproxy` is the canonical project origin.
- `ysuolmai/homeproxy` is the previous local fork and a source of selected
  behavior that is not present in the VIKINGYFY implementation.

## Local patch

The primary URLTest outbound has a configurable test URL on the Dashboard tab.
The LuCI form offers several common `generate_204` endpoints and accepts a
custom HTTP or HTTPS URL. The value is stored as
`homeproxy.config.main_urltest_url` and emitted as the sing-box URLTest
outbound's `url` field.

## Updating

1. Review changes from the VIKINGYFY package directory.
2. Preserve the `main_urltest_url` form, UCI default, validation, and generator
   mapping during every update.
3. Compare major routing or migration changes with canonical ImmortalWrt before
   adopting them.
4. Compile HomeProxy and inspect the generated package after every merge.
