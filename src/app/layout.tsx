import type { Metadata } from "next";
import { Bebas_Neue, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Same type family as the public CS Studio site (public/landing.html):
// Bebas Neue for headlines, Inter for body copy — so the CRM reads as the
// same product instead of a bolted-on internal tool.
const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Creative C · CRM",
  description: "CRM intern Creative C",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${bebasNeue.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
