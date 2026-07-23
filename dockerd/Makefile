include $(TOPDIR)/rules.mk

PKG_NAME:=dockerd
PKG_VERSION:=29.6.2
PKG_RELEASE:=2
PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_GIT_URL:=github.com/moby/moby
PKG_GIT_REF:=docker-v$(PKG_VERSION)
PKG_SOURCE_URL:=https://codeload.$(PKG_GIT_URL)/tar.gz/$(PKG_GIT_REF)?
PKG_HASH:=skip
PKG_GIT_SHORT_COMMIT:=3d80467

PKG_MAINTAINER:=Gerard Ryan <G.M0N3Y.2503@gmail.com>

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

GO_PKG:=github.com/docker/docker

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

define Package/dockerd/config
  source "$(SOURCE)/Config.in"
endef

define Package/dockerd
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=Docker Community Edition Daemon
  URL:=https://www.docker.com/
  DEPENDS:=$(GO_ARCH_DEPENDS) \
    +ca-certificates \
    +containerd \
    +firewall4 \
    +nftables-json \
    +KERNEL_SECCOMP:libseccomp \
    +kmod-nf-ipvs \
    +kmod-veth \
    +tini \
    +uci-firewall \
    +fuse-overlayfs \
    +kmod-vxlan +kmod-macvlan +kmod-dummy +kmod-crypto-gcm +kmod-crypto-seqiv +kmod-crypto-ghash +kmod-ipsec +kmod-nf-nathelper +kmod-nf-nathelper-extra +btrfs-progs \
    @!(mips||mips64||mipsel)
  USERID:=docker:docker
  MENU:=1
endef

define Package/dockerd/conffiles
/etc/config/dockerd
endef

define Package/dockerd/description
The Docker CE Engine.
endef

TAR_OPTIONS:=--strip-components 1 $(TAR_OPTIONS)
TAR_CMD=$(HOST_TAR) -C $(1) $(TAR_OPTIONS)
TARGET_LDFLAGS += $(if $(CONFIG_USE_GLIBC),-lc -lgcc_eh)

define Build/Prepare
	$(Build/Prepare/Default)
endef

BUILDTAGS:=
ifeq ($(KERNEL_SECCOMP),y)
BUILDTAGS += seccomp
endif
ifeq ($(CONFIG_SELINUX),y)
BUILDTAGS += selinux
endif

define Build/Compile
	( \
		cd $(PKG_BUILD_DIR); \
		$(GO_PKG_VARS) \
		DOCKER_GITCOMMIT=$(PKG_GIT_SHORT_COMMIT) \
		DOCKER_BUILDTAGS='$(BUILDTAGS)' \
		VERSION=$(PKG_VERSION) \
		./hack/make.sh binary; \
	)
endef

define Package/dockerd/install
	$(INSTALL_DIR) $(1)/usr/bin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/bundles/binary-daemon/dockerd $(1)/usr/bin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/bundles/binary-daemon/docker-proxy $(1)/usr/bin/

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_DATA) ./files/dockerd.uci-defaults $(1)/etc/uci-defaults/dockerd

	$(INSTALL_DIR) $(1)/opt/docker/

  ifeq ($(CONFIG_DOCKER_CHECK_CONFIG),y)
	$(INSTALL_DIR) $(1)/usr/share/docker/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/contrib/check-config.sh $(1)/usr/share/docker/
  endif

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/dockerd.init $(1)/etc/init.d/dockerd

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/dockerd $(1)/etc/config/dockerd

	# Must be after systcl 11-br-netfilter.conf from kmod-br-netfilter
	$(INSTALL_DIR) $(1)/etc/sysctl.d
	$(INSTALL_DATA) ./files/etc/sysctl.d/sysctl-br-netfilter-ip.conf \
		$(1)/etc/sysctl.d/12-br-netfilter-ip.conf
endef

define Package/dockerd/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	/etc/init.d/dockerd enable
	/etc/init.d/dockerd uciadd
	/etc/init.d/dockerd start
}
endef

define Package/dockerd/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	/etc/init.d/dockerd disable
	/etc/init.d/dockerd stop
	/etc/init.d/dockerd ucidel
}
endef

$(eval $(call BuildPackage,dockerd))
