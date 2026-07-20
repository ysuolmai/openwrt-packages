include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-moontvplus
PKG_VERSION:=1.0.0
PKG_RELEASE:=7
PKG_PO_VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)

PKG_MAINTAINER:=ysuolmai
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=LuCI support for MoonTVPlus
LUCI_DEPENDS:=+luci-base +moontvplus +rpcd +ucode
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
