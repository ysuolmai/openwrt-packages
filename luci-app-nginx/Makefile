include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-nginx
PKG_VERSION:=1.0.0
PKG_RELEASE:=7
PKG_MAINTAINER:=ysuolmai
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=Lightweight HTTPS reverse proxy with nginx
LUCI_DESCRIPTION:=Manage HTTPS virtual hosts while keeping LuCI on a loopback-only uhttpd
LUCI_DEPENDS:=+luci-base +nginx-ssl +rpcd-mod-ucode +acme-acmesh
LUCI_PKGARCH:=all

define Package/luci-app-nginx/conffiles
/etc/config/nginx_proxy
endef

define Package/luci-app-nginx/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
# Older releases restore uhttpd during prerm even on upgrade. Reapply the
# preserved configuration before the default postinst starts nginx-proxy.
if [ "$$(uci -q get nginx_proxy.main.enabled)" = 1 ]; then
	/usr/libexec/nginx-proxy-apply apply || exit 1
fi
exit 0
endef

define Package/luci-app-nginx/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || [ "$$PKG_UPGRADE" = 1 ] || \
	/usr/libexec/nginx-proxy-apply disable >/dev/null 2>&1
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
