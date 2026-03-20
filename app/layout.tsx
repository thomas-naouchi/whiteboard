import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhiteBoard",
  description: "Whiteboard is a minimal AI workspace for chatting with your files and getting grounded answers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
