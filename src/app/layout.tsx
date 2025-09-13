import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// import { ClerkProvider } from "@clerk/nextjs"; // Clerk 임시 비활성화

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShiftEasy - Smart Shift Management",
  description: "Intelligent shift scheduling for healthcare, manufacturing, and service industries",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}