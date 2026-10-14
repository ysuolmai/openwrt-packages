# LuCI Nginx Proxy

Lightweight HTTPS reverse proxies with an isolated Nginx instance. LuCI's
uhttpd backend stays on loopback; only configured management networks can
access its Nginx frontend.

## Let's Encrypt certificates

The package depends on OpenWrt `acme-acmesh` / `acme-common`. It uses their
standard UCI configuration, daily cron renewal and ACME hotplug notifications.
Use a feed providing the split `acme-acmesh` and `acme-common` packages
(e.g. OpenWrt 24.10); the legacy monolithic `acme` package is not supported.

1. Point the site's public DNS A/AAAA records to this router. All advertised
   addresses must reach it. Forward public TCP **80** to the router if needed.
2. Set the proxy's HTTP port to **80** and allow inbound HTTP in the relevant
   firewall zone (the plugin can manage this rule). Keep the port reachable
   for future renewals. Outbound HTTPS and correct router time are also needed.
3. Enter an **ACME account email**, add an enabled reverse proxy, and select
   **Let's Encrypt (HTTP-01)** as its certificate source.
4. Click **Request / check certificates**. This saves and applies the proxy
   configuration, then launches the ACME check in the background. Check the
   certificate status/recent log below; detailed failures also appear in
   `logread` under the system ACME service.

Before the first certificate is available, that site's HTTP listener serves
only `/.well-known/acme-challenge/`; other requests return 503. On issuance,
Nginx validates its new configuration and reloads to enable HTTPS. Thereafter,
HTTP redirects to HTTPS except for the challenge path. Renewal failures leave
existing Nginx workers running; a failed configuration check prevents reload.
This does not extend the lifetime of an expired certificate.

The system ACME service checks daily and renews when due. The button uses the
same check, without forcing renewal or bypassing CA rate limits. Rebooted
routers recreate the temporary challenge directory when ACME runs. Account
state and certificates live under `/etc/acme` and `/etc/ssl/acme`, which the
ACME package preserves across configuration-preserving sysupgrades.

This version supports one ordinary domain per reverse proxy. Wildcard
certificates and DNS-01 configuration are not included. LuCI's IP-based
management HTTPS continues to use its separately uploaded certificate.
Existing manually uploaded site certificates remain supported.

## Shared ACME service

Only certificate sections named `nginx_proxy_*` in `/etc/config/acme` are
owned by this plugin; don't use that prefix for unrelated jobs. Applying the
configuration reconciles these sections and removes entries for deleted,
disabled or manual-certificate sites. Disabling or uninstalling the plugin
removes its jobs, preserving accounts, certificates and other ACME jobs.

The email is the **shared ACME account email**, and the request/check button
checks **all enabled system ACME jobs**, including ones configured elsewhere.
The plugin enables the system ACME and cron services; it leaves them enabled
when disabled so unrelated scheduled jobs continue running. Existing ACME
jobs for the same domain should be consolidated to avoid conflicting settings.

## Checks

```sh
python3 luci-app-nginx/tests/test_acme.py
./scripts/validate.sh
git diff --check
```

The regression check runs real shell helpers with temporary UCI/network stubs.
For real Nginx config and HTTP challenge tests on an isolated Docker host:

```sh
NGINX_TEST_IMAGE=nginx:alpine python3 luci-app-nginx/tests/test_acme.py
```

Tests use a temporary self-signed certificate and never request a real
Let's Encrypt certificate or modify the host's OpenWrt configuration.
