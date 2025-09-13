import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SettingsMenu } from "@/components/SettingsMenu";
import { I18nProvider } from "@/components/providers/I18nProvider";
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
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <I18nProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            <div className="fixed top-4 right-4 z-50">
              <SettingsMenu />
            </div>
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}