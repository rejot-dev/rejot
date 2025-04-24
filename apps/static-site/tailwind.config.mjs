import defaultTheme from "tailwindcss/defaultTheme";

import tailwindTypography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Atkinson Hyperlegible", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        "rejot-red": {
          50: "#fff1f3",
          100: "#ffdfe4",
          200: "#ffc5cd",
          300: "#ff9dab",
          400: "#ff647a",
          500: "#ff3451",
          600: "#ee1e3c", // primary
          700: "#c80d28",
          800: "#a50f25",
          900: "#881425",
          950: "#4b040e",
        },
        "rejot-orange": {
          50: "#fff7eb",
          100: "#ffe9c6",
          200: "#ffd088",
          300: "#ffae42", // primary
          400: "#ff9620",
          500: "#f97007",
          600: "#dd4c02",
          700: "#b73106",
          800: "#94250c",
          900: "#7a200d",
          950: "#460d02",
        },
        "rejot-black": {
          50: "#f3f5fc",
          100: "#e6ecf8",
          200: "#c7d7f0",
          300: "#96b4e3",
          400: "#5d8ed3",
          500: "#3970be",
          600: "#2856a1",
          700: "#224582",
          800: "#203d6c",
          900: "#1f345b",
          950: "#0d1526", // primary
        },
      },
    },
  },
  plugins: [tailwindTypography],
};
