include $(TOPDIR)/rules.mk

PKG_NAME:=frp
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_MAINTAINER:=ysuolmai
PKG_LICENSE:=Apache-2.0
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/frp
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  TITLE:=FRP client and server OpenWrt integration
  URL:=https://github.com/fatedier/frp
  DEPENDS:=+ca-bundle +curl +jsonfilter
  PROVIDES:=frpc frps frp-common
  REPLACES:=frpc frps frp-common
  CONFLICTS:=frpc frps frp-common
endef

define Package/frp/description
  Lightweight client and server integration. The latest official frpc and
  frps cores are downloaded together from fatedier/frp stable releases.
endef

define Package/frp/conffiles
/etc/config/frpc
/etc/config/frps
endef

define Build/Compile
endef

define Package/frp/install
	$(INSTALL_DIR) $(1)/usr/libexec/
	$(INSTALL_BIN) ./files/frp-generate $(1)/usr/libexec/
	$(INSTALL_BIN) ./files/frp-update-core $(1)/usr/libexec/
	$(INSTALL_DIR) $(1)/etc/frp/frpc.d/ $(1)/etc/frp/frps.d/
	$(INSTALL_DIR) $(1)/etc/init.d/
	$(INSTALL_BIN) ./files/frpc.init $(1)/etc/init.d/frpc
	$(INSTALL_BIN) ./files/frps.init $(1)/etc/init.d/frps
	$(INSTALL_DIR) $(1)/etc/config/
	$(INSTALL_CONF) ./files/frpc.config $(1)/etc/config/frpc
	$(INSTALL_CONF) ./files/frps.config $(1)/etc/config/frps
	$(INSTALL_DIR) $(1)/etc/uci-defaults/
	$(INSTALL_BIN) ./files/frpc.uci-defaults $(1)/etc/uci-defaults/90-frpc
endef

$(eval $(call BuildPackage,frp))
