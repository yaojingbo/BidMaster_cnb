const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bidmaster.asia";

const routes = ["/", "/workbench", "/extract", "/simulate", "/statistics", "/cli"];

export default function sitemap() {
  return routes.map(route => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "/" ? 1 : 0.8,
  }));
}
