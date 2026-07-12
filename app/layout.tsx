import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Prompt Overflow",
  description:
    "Prompt Overflow is a question and answer site for people sharing prompts that build websites, apps, and cool ideas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <div className="container">
          <div className="content-wrapper">{children}</div>
        </div>
        <Footer />
      </body>
    </html>
  );
}
