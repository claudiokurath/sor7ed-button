import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SOR7ED BUTTON",
  description: "Save it. Get it on WhatsApp.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", color: "#111", background: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
