import type { Metadata } from "next";
import "./globals.css";
import Nav from "./Nav";
import ChatBubble from "./ChatBubble";

export const metadata: Metadata = {
  title: "Ward Watch",
  description:
    "Look up GHMC/CMC/MMC wards and ask questions about Hyderabad's civic budget and documents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="bg-art" aria-hidden="true" />
        <div className="shell">
          <Nav />
          <div className="banner">
            Hyderabad&apos;s three municipal corporations — GHMC (Greater
            Hyderabad), CMC (Cyberabad) and MMC (Malkajgiri) — are currently
            run by appointed Special Officers; councils&apos; terms ended and
            no election date is confirmed yet.
          </div>
          <main className="main">{children}</main>
          <footer className="footer">Made with ❤️ in Hyderabad, for Hyderabad</footer>
        </div>
        <ChatBubble />
      </body>
    </html>
  );
}
