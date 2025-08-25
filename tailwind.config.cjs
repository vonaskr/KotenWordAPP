// tailwind.config.js  ← 新規（ESM）
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:"#FFF4EC",100:"#FFE6D3",200:"#FFD1B0",300:"#FFBD8D",
          400:"#FFA867",500:"#FF9443",600:"#FF8C3A",700:"#FF7A1A"
        },
        ink: "#1F2937",
        muted: "#F7F7F9",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.06)",
        card: "0 8px 24px rgba(255,122,26,0.12)",
      },
    },
  },
  plugins: [],
};
