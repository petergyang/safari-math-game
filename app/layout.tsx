import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serena’s Safari Math",
  description: "A wildly fun multiplication adventure from 1 × 1 to 12 × 12.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  openGraph: { title: "Serena’s Safari Math", description: "Multiply. Master. Roar!" },
  twitter: { card: "summary", title: "Serena’s Safari Math", description: "Multiply. Master. Roar!" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
