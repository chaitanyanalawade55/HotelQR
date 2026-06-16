import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1C1C2E",
          light: "#252540",
          muted: "#3D3D5C",
        },
        orange: {
          DEFAULT: "#F97316",
          light: "#FFF7ED",
          dark: "#EA6C0A",
          muted: "#FED7AA",
        },
        parchment: {
          DEFAULT: "#FFFAF3",
          dark: "#FFF3E0",
        },
        ink: {
          DEFAULT: "#0F0E17",
          soft: "#374151",
          muted: "#6B7280",
          ghost: "#9CA3AF",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          raised: "#F8F9FA",
          sunken: "#F3F4F6",
        },
        veg: "#10B981",
        nonveg: "#EF4444",
        border: {
          DEFAULT: "#E5E7EB",
          strong: "#D1D5DB",
        },
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
