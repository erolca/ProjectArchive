import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "../components/layout/auth-gate";

export const metadata: Metadata = {
  title: "ProjectArchive",
  description: "Industrial automation project archive system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
