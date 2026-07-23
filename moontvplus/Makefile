include $(TOPDIR)/rules.mk

PKG_NAME:=moontvplus
PKG_VERSION:=2026.07.13
PKG_RELEASE:=11

MOONTVPLUS_BUILD_CORE?=0

ifeq ($(MOONTVPLUS_BUILD_CORE),1)
PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/ysuolmai/MoonTVPlus.git
PKG_SOURCE_VERSION:=720db22bea9f9798ecc00cc2c7c0127813f5e256
PKG_MIRROR_HASH:=skip
PKG_BUILD_DEPENDS:=node/host node node-gyp/host node-pnpm/host
endif

PKG_MAINTAINER:=ysuolmai
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

include $(INCLUDE_DIR)/package.mk

define Package/moontvplus
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=MoonTVPlus media aggregation server
  URL:=https://github.com/ysuolmai/MoonTVPlus
  DEPENDS:=@ARCH_64BIT @HAS_FPU +libstdcpp +libatomic +libopenssl +zlib +libnghttp2 +libcares +curl +jsonfilter +ca-bundle
endef

define Package/moontvplus/description
 MoonTVPlus is a Next.js media aggregation and playback server. This package
 runs it directly under procd without a container runtime.
endef

define Package/moontvplus/conffiles
/etc/config/moontvplus
/etc/moontvplus/
endef

CORE_ARCH:=$(if $(ARCH_PACKAGES),$(ARCH_PACKAGES),$(ARCH))
CORE_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)

ifeq ($(MOONTVPLUS_BUILD_CORE),1)
NODEJS_CPU:=$(subst aarch64,arm64,$(subst x86_64,x64,$(ARCH)))
PNPM:=$(STAGING_DIR_HOSTPKG)/bin/pnpm
PNPM_FLAGS:=--config.manage-package-manager-versions=false
PNPM_ENV:=npm_config_manage_package_manager_versions=false
PNPM_STORE_DIR:=$(TMP_DIR)/pnpm-store/moontvplus
BETTER_SQLITE3_VERSION:=12.6.2
BETTER_SQLITE3_DIR:=$(PKG_BUILD_DIR)/node_modules/.pnpm/better-sqlite3@$(BETTER_SQLITE3_VERSION)/node_modules/better-sqlite3
STANDALONE_BETTER_SQLITE3_DIR:=$(PKG_BUILD_DIR)/.next/standalone/node_modules/.pnpm/better-sqlite3@$(BETTER_SQLITE3_VERSION)/node_modules/better-sqlite3
CORE_ARTIFACT_DIR:=$(PKG_BUILD_DIR)/.openwrt-artifacts
CORE_ROOT:=$(PKG_BUILD_DIR)/.openwrt-core

define Build/Compile
	mkdir -p $(PKG_BUILD_DIR)/.pnpm-home $(PNPM_STORE_DIR)
	cd $(PKG_BUILD_DIR) && \
		HOME=$(PKG_BUILD_DIR)/.pnpm-home \
		CI=1 \
		$(PNPM_ENV) \
		$(PNPM) $(PNPM_FLAGS) install --frozen-lockfile --ignore-scripts \
			--network-concurrency=8 --store-dir=$(PNPM_STORE_DIR)
	cd $(PKG_BUILD_DIR) && \
		HOME=$(PKG_BUILD_DIR)/.pnpm-home \
		CI=1 \
		$(PNPM_ENV) \
		DOCKER_ENV=true \
		BUILD_TARGET=openwrt \
		NODE_OPTIONS=--max-old-space-size=3072 \
		$(STAGING_DIR_HOSTPKG)/bin/node scripts/generate-manifest.js
	cd $(PKG_BUILD_DIR) && \
		HOME=$(PKG_BUILD_DIR)/.pnpm-home \
		CI=1 \
		DOCKER_ENV=true \
		BUILD_TARGET=openwrt \
		NODE_OPTIONS=--max-old-space-size=3072 \
		$(STAGING_DIR_HOSTPKG)/bin/node node_modules/next/dist/bin/next build
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
	mkdir -p $(STANDALONE_BETTER_SQLITE3_DIR)/build/Release
	cp $(BETTER_SQLITE3_DIR)/build/Release/better_sqlite3.node \
		$(STANDALONE_BETTER_SQLITE3_DIR)/build/Release/better_sqlite3.node
	find $(PKG_BUILD_DIR)/.next/standalone -type d -path '*/better-sqlite3/build/Release' \
		-exec cp $(BETTER_SQLITE3_DIR)/build/Release/better_sqlite3.node {}/better_sqlite3.node \;
	test -s $(STANDALONE_BETTER_SQLITE3_DIR)/build/Release/better_sqlite3.node

	rm -rf $(CORE_ROOT) $(CORE_ARTIFACT_DIR)
	mkdir -p $(CORE_ROOT)/moontvplus $(CORE_ARTIFACT_DIR)
	$(CP) $(PKG_BUILD_DIR)/.next/standalone/. $(CORE_ROOT)/moontvplus/
	$(CP) $(PKG_BUILD_DIR)/scripts $(CORE_ROOT)/moontvplus/
	$(CP) $(PKG_BUILD_DIR)/migrations $(CORE_ROOT)/moontvplus/
	$(CP) $(PKG_BUILD_DIR)/public $(CORE_ROOT)/moontvplus/
	mkdir -p $(CORE_ROOT)/moontvplus/.next
	$(CP) $(PKG_BUILD_DIR)/.next/static $(CORE_ROOT)/moontvplus/.next/
	# Next standalone omits compiled webpack helpers and custom-server deps.
	next_source="$$$$(readlink -f $(PKG_BUILD_DIR)/node_modules/next)"; \
		next_target="$$$$(readlink -f $(CORE_ROOT)/moontvplus/node_modules/next)"; \
		test -d "$$$$next_source/dist/compiled"; \
		mkdir -p "$$$$next_target/dist/compiled"; \
		cp -LR "$$$$next_source/dist/compiled/." "$$$$next_target/dist/compiled/"; \
			mkdir -p $(CORE_ROOT)/moontvplus/node_modules; \
			for dep_name in socket.io accepts base64id bufferutil cookie cors debug engine.io engine.io-parser mime-db mime-types ms negotiator node-gyp-build object-assign socket.io-adapter socket.io-parser vary ws; do \
				dep_path="$$$$(find $(PKG_BUILD_DIR)/node_modules/.pnpm -path "*/node_modules/$$$$dep_name" -type d -print -quit)"; \
				[ -d "$$$$dep_path" ] || continue; \
				cp -LR "$$$$dep_path" "$(CORE_ROOT)/moontvplus/node_modules/$$$$dep_name"; \
			done; \
			dep_path="$$$$(find $(PKG_BUILD_DIR)/node_modules/.pnpm -path '*/node_modules/@socket.io/component-emitter' -type d -print -quit)"; \
			[ -d "$$$$dep_path" ] && { mkdir -p $(CORE_ROOT)/moontvplus/node_modules/@socket.io; cp -LR "$$$$dep_path" $(CORE_ROOT)/moontvplus/node_modules/@socket.io/component-emitter; } || true
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/start.js $(CORE_ROOT)/moontvplus/start.js
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/server.js $(CORE_ROOT)/moontvplus/server.js
	mkdir -p $(CORE_ROOT)/moontvplus/src/lib
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/src/lib/tv-remote-hub.js \
		$(CORE_ROOT)/moontvplus/src/lib/tv-remote-hub.js
	rm -f $(CORE_ROOT)/moontvplus/public/screenshot1.png \
		$(CORE_ROOT)/moontvplus/public/screenshot2.png \
		$(CORE_ROOT)/moontvplus/public/screenshot3.png \
		$(CORE_ROOT)/moontvplus/public/assets/jassub/NotoSansCJK-Regular.ttc
	find $(CORE_ROOT)/moontvplus -type f -exec sh -c \
		'file "$$$$1" | grep -q "ELF .* x86-64" && rm -f "$$$$1" || true' sh {} \;
	test -x $(STAGING_DIR_ROOT)/usr/bin/node
	$(INSTALL_BIN) $(STAGING_DIR_ROOT)/usr/bin/node $(CORE_ROOT)/moontvplus/node
	$(TARGET_CROSS)strip --strip-unneeded $(CORE_ROOT)/moontvplus/node
	node_abi="$$$$(sed -n 's/^#define NODE_MODULE_VERSION \([0-9][0-9]*\)$$$$/\1/p' \
		$(STAGING_DIR)/usr/include/node/node_version.h)"; \
	test -n "$$$$node_abi"; \
	printf '%s\n' \
		'version=$(CORE_VERSION)' \
		'arch=$(CORE_ARCH)' \
		"node_module_version=$$$$node_abi" \
		>$(CORE_ROOT)/moontvplus/.moontvplus-core
	tar -C $(CORE_ROOT) -czf \
		$(CORE_ARTIFACT_DIR)/moontvplus-core_$(CORE_VERSION)_$(CORE_ARCH).tar.gz \
		moontvplus
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/public/assets/jassub/NotoSansCJK-Regular.ttc \
		$(CORE_ARTIFACT_DIR)/moontvplus-jassub-font_$(CORE_VERSION).ttc
endef
else
define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
	:
endef
endif

define Package/moontvplus/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/moontvplus.config $(1)/etc/config/moontvplus
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/moontvplus.init $(1)/etc/init.d/moontvplus
	$(INSTALL_DIR) $(1)/usr/share/moontvplus
	$(INSTALL_BIN) ./files/update_core.sh $(1)/usr/share/moontvplus/update_core.sh
	printf '%s\n' '$(CORE_ARCH)' >$(1)/usr/share/moontvplus/core-arch
	printf '%s\n' '$(CORE_VERSION)' >$(1)/usr/share/moontvplus/package-version
	$(INSTALL_DIR) $(1)/etc/moontvplus
endef

define Package/moontvplus/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	mkdir -p /etc/moontvplus /mnt/moontvplus/core /mnt/moontvplus/downloads
	chmod 0755 /mnt/moontvplus /mnt/moontvplus/core /mnt/moontvplus/downloads
	chown nobody:nogroup /etc/moontvplus /mnt/moontvplus/downloads 2>/dev/null || true
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
