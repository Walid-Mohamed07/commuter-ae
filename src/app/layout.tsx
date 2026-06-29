import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commuter — Cairo Ride Booking",
  description:
    "Book affordable private and shared rides across Greater Cairo, Egypt.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
