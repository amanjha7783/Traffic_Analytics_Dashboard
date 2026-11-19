/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "var(--color-primary)",
        "primary-container": "var(--color-primary-container)",
        "on-primary": "var(--color-on-primary)",
        "on-primary-container": "var(--color-on-primary-container)",
        "secondary": "var(--color-secondary)",
        "secondary-container": "var(--color-secondary-container)",
        "on-secondary": "var(--color-on-secondary)",
        "on-secondary-container": "var(--color-on-secondary-container)",
        "tertiary": "var(--color-tertiary)",
        "tertiary-container": "var(--color-tertiary-container)",
        "on-tertiary": "var(--color-on-tertiary)",
        "on-tertiary-container": "var(--color-on-tertiary-container)",
        "error": "var(--color-error)",
        "error-container": "var(--color-error-container)",
        "on-error": "var(--color-on-error)",
        "on-error-container": "var(--color-on-error-container)",
        "warning": "var(--color-warning)",
        "success": "var(--color-success)",
        "danger": "var(--color-error)",
        "background": "var(--color-background)",
        "on-background": "var(--color-on-background)",
        "surface": "var(--color-surface)",
        "surface-dim": "var(--color-surface-dim)",
        "surface-bright": "var(--color-surface-bright)",
        "surface-container-lowest": "var(--color-surface-container-lowest)",
        "surface-container-low": "var(--color-surface-container-low)",
        "surface-container": "var(--color-surface-container)",
        "surface-container-high": "var(--color-surface-container-high)",
        "surface-container-highest": "var(--color-surface-container-highest)",
        "on-surface": "var(--color-on-surface)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        "outline": "var(--color-outline)",
        "outline-variant": "var(--color-outline-variant)",
      },
      borderRadius: {
        "sm": "0.125rem",  /* 2px */
        "DEFAULT": "0.25rem", /* 4px */
        "md": "0.375rem",  /* 6px */
        "lg": "0.5rem",    /* 8px */
        "xl": "0.625rem",  /* 10px */
        "full": "9999px"
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        "display-lg": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "headline-sm": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "data-mono-lg": ["JetBrains Mono", "monospace"],
        "data-mono-md": ["JetBrains Mono", "monospace"],
        "data-mono-sm": ["JetBrains Mono", "monospace"],
        "label-caps": ["JetBrains Mono", "monospace"]
      },
      fontSize: {
        "display-lg": ["28px", { lineHeight: "36px", letterSpacing: "-0.015em", fontWeight: "700" }],
        "headline-lg": ["22px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["17px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "600" }],
        "headline-sm": ["14px", { lineHeight: "20px", letterSpacing: "0em", fontWeight: "600" }],
        "body-lg": ["15px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "400" }],
        "body-md": ["13px", { lineHeight: "18px", letterSpacing: "0em", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.005em", fontWeight: "400" }],
        "data-mono-lg": ["22px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "data-mono-md": ["13px", { lineHeight: "18px", letterSpacing: "0em", fontWeight: "500" }],
        "data-mono-sm": ["11px", { lineHeight: "15px", letterSpacing: "0.01em", fontWeight: "500" }],
        "label-caps": ["10px", { lineHeight: "14px", letterSpacing: "0.06em", fontWeight: "600" }]
      },
      boxShadow: {
        "subtle": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "card": "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
      }
    },
  },
  plugins: [],
}
