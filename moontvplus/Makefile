include $(TOPDIR)/rules.mk

PKG_NAME:=moontvplus
PKG_VERSION:=2026.07.13
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/ysuolmai/MoonTVPlus.git
PKG_SOURCE_VERSION:=720db22bea9f9798ecc00cc2c7c0127813f5e256
PKG_MIRROR_HASH:=skip

PKG_MAINTAINER:=ysuolmai
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

PKG_BUILD_DEPENDS:=node/host node-gyp/host node-pnpm/host
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

include $(INCLUDE_DIR)/package.mk

define Package/moontvplus
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=MoonTVPlus media aggregation server
  URL:=https://github.com/ysuolmai/MoonTVPlus
  DEPENDS:=@ARCH_64BIT @HAS_FPU +node +libstdcpp +libatomic
endef

define Package/moontvplus/description
 MoonTVPlus is a Next.js media aggregation and playback server. This package
 runs it directly under procd without a container runtime.
endef

define Package/moontvplus/conffiles
/etc/config/moontvplus
/etc/moontvplus/
endef

NODEJS_CPU:=$(subst aarch64,arm64,$(subst x86_64,x64,$(ARCH)))
PNPM:=$(STAGING_DIR_HOSTPKG)/bin/pnpm
BETTER_SQLITE3_DIR:=$(PKG_BUILD_DIR)/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3

define Build/Compile
	mkdir -p $(PKG_BUILD_DIR)/.pnpm-home
	cd $(PKG_BUILD_DIR) && \
		HOME=$(PKG_BUILD_DIR)/.pnpm-home \
		CI=1 \
		$(PNPM) install --frozen-lockfile --ignore-scripts --network-concurrency=8
	cd $(PKG_BUILD_DIR) && \
		HOME=$(PKG_BUILD_DIR)/.pnpm-home \
		CI=1 \
		DOCKER_ENV=true \
		BUILD_TARGET=openwrt \
		NODE_OPTIONS=--max-old-space-size=3072 \
		$(PNPM) run build
	rm -rf $(BETTER_SQLITE3_DIR)/build
	cd $(BETTER_SQLITE3_DIR) && \
		$(MAKE_VARS) \
		$(MAKE_FLAGS) \
		npm_config_nodedir=$(STAGING_DIR)/usr \
		npm_config_arch=$(NODEJS_CPU) \
		npm_config_target_arch=$(NODEJS_CPU) \
		$(STAGING_DIR_HOSTPKG)/bin/node-gyp rebuild --release
	$(TARGET_CROSS)strip --strip-unneeded \
		$(BETTER_SQLITE3_DIR)/build/Release/better_sqlite3.node
	find $(PKG_BUILD_DIR)/.next/standalone -name better_sqlite3.node \
		-exec cp $(BETTER_SQLITE3_DIR)/build/Release/better_sqlite3.node {} \;
endef

define Package/moontvplus/install
	$(INSTALL_DIR) $(1)/usr/lib/moontvplus
	$(CP) $(PKG_BUILD_DIR)/.next/standalone/. $(1)/usr/lib/moontvplus/
	$(CP) $(PKG_BUILD_DIR)/scripts $(1)/usr/lib/moontvplus/
	$(CP) $(PKG_BUILD_DIR)/migrations $(1)/usr/lib/moontvplus/
	$(CP) $(PKG_BUILD_DIR)/public $(1)/usr/lib/moontvplus/
	$(INSTALL_DIR) $(1)/usr/lib/moontvplus/.next
	$(CP) $(PKG_BUILD_DIR)/.next/static $(1)/usr/lib/moontvplus/.next/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/start.js $(1)/usr/lib/moontvplus/start.js
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/server.js $(1)/usr/lib/moontvplus/server.js
	$(INSTALL_DIR) $(1)/usr/lib/moontvplus/src/lib
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/src/lib/tv-remote-hub.js \
		$(1)/usr/lib/moontvplus/src/lib/tv-remote-hub.js

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/moontvplus.config $(1)/etc/config/moontvplus
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/moontvplus.init $(1)/etc/init.d/moontvplus
	$(INSTALL_DIR) $(1)/etc/moontvplus
endef

define Package/moontvplus/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	mkdir -p /etc/moontvplus /mnt/moontvplus/downloads
	chown nobody:nogroup /etc/moontvplus /mnt/moontvplus /mnt/moontvplus/downloads 2>/dev/null || true
	/etc/init.d/moontvplus enable >/dev/null 2>&1 || true
}
exit 0
endef

define Package/moontvplus/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/moontvplus disable >/dev/null 2>&1 || true
	/etc/init.d/moontvplus stop >/dev/null 2>&1 || true
}
exit 0
endef

$(eval $(call BuildPackage,moontvplus))
