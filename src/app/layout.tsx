import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bidmaster.asia";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bid Master Web",
    template: "%s | Bid Master Web",
  },
  description: "招投标智能分析工具箱 - AI驱动的招标文件智能提取、模拟编制、开标报价分析",
  applicationName: "Bid Master Web",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Bid Master Web",
    description: "AI 驱动的招标文件智能提取、模拟编制、开标报价分析工具箱",
    url: siteUrl,
    siteName: "Bid Master Web",
    locale: "zh_CN",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020817" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Bid Master Web",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "AI 驱动的招投标智能分析工具箱，支持招标文件要素提取、模拟编制和开标报价分析。",
    url: siteUrl,
  };

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
