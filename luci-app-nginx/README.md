# LuCI Nginx Proxy

Lightweight HTTPS reverse proxies with an isolated Nginx instance. LuCI's
uhttpd backend stays on loopback; only configured management networks can
access its Nginx frontend.

## Upgrading existing configurations

Existing `/etc/config/nginx_proxy` and `/etc/nginx-proxy/` certificate files
are retained during normal package upgrades. Sites without a
`certificate_source` field default to manual certificates; existing
`cert_id`, `certificate` and `private_key` settings still work. ACME email
and the port-80 requirement apply only to enabled automatic-certificate sites.
No migration or manual edits are needed to retain manual certificates.

Release 7 also reapplies an enabled proxy during live installation/upgrade:
older package removal scripts restore uhttpd's public listeners even during
upgrades, so the new post-install script must take them back before starting
Nginx. Subsequent upgrades skip full removal cleanup. A brief service restart
is expected. Genuine uninstall still restores uhttpd. Offline firmware image
installation skips these live actions.

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
3. Add/edit an enabled reverse proxy and select **Let's Encrypt (HTTP-01)**
   as its certificate source. The domain editor fills the email as
   `admin@<domain>`; you can replace it. Existing site or legacy global email
   settings take precedence over this default. Empty emails also default on
   the backend, so older configurations need no migration.
4. Click **Request / check certificate** in that domain's editor. This saves
   the editor and service settings, applies the proxy configuration, then
   launches a background check for **only this domain**. Its certificate
   expiry and recent request log appear in the same editor; detailed ACME
   failures also appear in `logread`. Manual certificate sources instead show
   the PEM and KEY upload buttons.

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

Each domain's request/check button runs only its own generated ACME section,
using the installed acme-common wrapper's configuration loader and certificate
hook. Manual requests are serialized because account state is shared; the
request log and status are separate for each domain. Daily cron still checks
all enabled system ACME jobs. Account state is shared, and daily cron uses
the first enabled proxy's email as the shared ACME email. The per-domain
email is used when manually issuing that domain's certificate; changing an
email does not create a separate ACME account.
The plugin enables the system ACME and cron services; it leaves them enabled
when disabled so unrelated scheduled jobs continue running. Existing ACME
jobs for the same domain should be consolidated to avoid conflicting settings.

## Checks

```sh
python3 luci-app-nginx/tests/test_acme.py
node luci-app-nginx/tests/test_ui.js
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
