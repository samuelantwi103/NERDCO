import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NERDCO — National Emergency Response & Dispatch Coordination",
  description: "NERDCO Emergency Operations Platform",
};

import { ServiceHealthOverlay } from "@/components/ServiceHealthOverlay";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <ServiceHealthOverlay />
      </body>
    </html>
  );
}
