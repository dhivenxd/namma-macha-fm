import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Namma Macha FM 98.6 — Bengaluru After Hours",
  description: "Bengaluru stories, local nonsense, and late-night radio from Namma Macha FM.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
