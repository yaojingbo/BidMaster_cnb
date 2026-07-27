export default function manifest() {
  return {
    name: "Bid Master Web",
    short_name: "BidMaster",
    description: "招投标智能分析工具箱",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
