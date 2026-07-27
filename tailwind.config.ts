import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/frontend/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "oklch(55% 0.18 340)",
          foreground: "oklch(98% 0 0)",
        },
        secondary: {
          DEFAULT: "oklch(65% 0.14 340)",
          foreground: "oklch(98% 0 0)",
        },
        accent: {
          DEFAULT: "oklch(70% 0.12 360)",
          foreground: "oklch(20% 0 0)",
        },
        destructive: {
          DEFAULT: "oklch(55% 0.2 25)",
          foreground: "oklch(98% 0 0)",
        },
        success: {
          DEFAULT: "oklch(60% 0.15 145)",
          foreground: "oklch(98% 0 0)",
        },
        warning: {
          DEFAULT: "oklch(75% 0.15 80)",
          foreground: "oklch(20% 0 0)",
        },
        background: "oklch(98% 0 0)",
        foreground: "oklch(20% 0 0)",
        muted: {
          DEFAULT: "oklch(95% 0 0)",
          foreground: "oklch(40% 0 0)",
        },
        border: "oklch(90% 0 0)",
        card: {
          DEFAULT: "oklch(100% 0 0)",
          foreground: "oklch(20% 0 0)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;