# HomeProxy upstream policy

The package uses `VIKINGYFY/packages/luci-app-homeproxy` as its primary
upstream. This version was selected for its newer sing-box 1.14 architecture,
dashboard integration, runtime port allocation, and streamlined GeoSite/GeoIP
routing resources.

The matching `VIKINGYFY/packages/sing-box` directory is mirrored alongside
HomeProxy. CI consumers must remove feed and third-party copies of both packages
before cloning this collection so HomeProxy and its runtime stay compatible.

Two other source lines remain tracked for comparison:

- `immortalwrt/homeproxy` is the canonical project origin.
- `ysuolmai/homeproxy` is the previous local fork and a source of selected
  behavior that is not present in the VIKINGYFY implementation.

## Local patch

The primary URLTest outbound has a configurable test URL on the Dashboard tab,
next to the main URLTest node selection.
The LuCI form offers several common `generate_204` endpoints and accepts a
custom HTTP or HTTPS URL. The value is stored as
`homeproxy.config.main_urltest_url` and emitted as the sing-box URLTest
outbound's `url` field.

## Updating

1. Review changes from the VIKINGYFY package directory.
2. Sync the matching VIKINGYFY sing-box recipe in the same update.
3. Preserve the `main_urltest_url` form, UCI default, validation, and generator
   mapping during every update.
4. Compare major routing or migration changes with canonical ImmortalWrt before
   adopting them.
5. Compile sing-box and HomeProxy and inspect the generated packages after every
   merge.
