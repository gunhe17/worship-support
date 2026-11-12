import type { Metadata, Viewport } from "next";

import Shell from "@/features/shell/Shell";
import Toaster from "@/ui/Toaster";

import "./globals.css";

export const metadata: Metadata = {
  title: "Worship",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Shell>{children}</Shell>
        <Toaster />
      </body>
    </html>
  );
}
