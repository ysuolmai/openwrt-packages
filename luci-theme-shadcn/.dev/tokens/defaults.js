/**
 * Copyright (C) 2025 eamonxg <eamonxiong@gmail.com>
 * Licensed under the Apache License, Version 2.0.
 */

// Editable input colors per mode. Everything else is derived in spec.js.
// Teal palette: brand oklch(0.648 0.097 195); cool low-chroma
// surfaces follow the same hue for a consistent custom fork theme.
export const DEFAULTS = {
  light: {
    bg: "oklch(0.985 0.004 195)",
    surface: "oklch(1 0 0)",
    text: "oklch(0.15 0.02 195)",
    brand: "oklch(0.648 0.097 195)",
    on_brand: "oklch(1 0 0)",
    success: "oklch(0.60 0.18 155)",
    warning: "oklch(0.75 0.18 75)",
    danger: "oklch(0.55 0.22 25)",
    info: "oklch(0.60 0.15 230)",
    overlay_base: "oklch(0 0 0)",
  },
  dark: {
    bg: "oklch(0.145 0.022 195)",
    surface: "oklch(0.185 0.025 195)",
    text: "oklch(0.92 0.01 195)",
    brand: "oklch(0.648 0.097 195)",
    on_brand: "oklch(1 0 0)",
    success: "oklch(0.60 0.18 155)",
    warning: "oklch(0.75 0.18 75)",
    danger: "oklch(0.55 0.22 25)",
    info: "oklch(0.60 0.15 230)",
    overlay_base: "oklch(0 0 0)",
  },
};
