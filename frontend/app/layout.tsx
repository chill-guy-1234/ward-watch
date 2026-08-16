import type { Metadata } from "next";
import "./globals.css";
import Nav from "./Nav";

export const metadata: Metadata = {
  title: "Ward Watch",
  description:
    "Ask questions about Hyderabad's civic budget and documents, and look up GHMC/CMC/MMC wards.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Nav />
          <div className="banner">
            GHMC, CMC and MMC are currently run by appointed Special
            Officers — councils&apos; terms ended and no election date is
            confirmed yet.
          </div>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
