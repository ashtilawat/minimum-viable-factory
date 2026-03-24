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
        trello: {
          blue: "#0052CC",
          "blue-dark": "#0747A6",
          "blue-light": "#4C9AFF",
          green: "#36B37E",
          yellow: "#FFAB00",
          red: "#FF5630",
          purple: "#6554C0",
          teal: "#00B8D9",
          "board-bg": "#0079BF",
          "list-bg": "#ebecf0",
          "card-bg": "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
