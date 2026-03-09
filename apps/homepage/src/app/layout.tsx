import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meliorra株式会社 | 責任ある進化で、未来を紡ぐ",
  description:
    "Meliorra株式会社は、AI技術を活用した意思決定支援と事業構築を通じて、責任ある進化で未来を紡ぐ企業です。",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Meliorra株式会社 | 責任ある進化で、未来を紡ぐ",
    description:
      "AI技術を活用した意思決定支援と事業構築を通じて、責任ある進化で未来を紡ぐ。",
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&family=Noto+Sans+JP:wght@200;300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
