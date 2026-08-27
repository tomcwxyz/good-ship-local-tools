import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attention agent pilot",
  description: "One attention layer across Tending, Swells and Glade.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
