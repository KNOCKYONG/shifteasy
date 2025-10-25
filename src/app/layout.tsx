import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SettingsMenu } from "@/components/SettingsMenu";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NavigationHeader } from "@/components/layout/NavigationHeader";

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
    <ClerkProvider
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#2563eb',
        },
      }}
    >
      <html lang="ko" suppressHydrationWarning>
        <body className={inter.className}>
          <ErrorBoundary>
            <TRPCProvider>
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
                  <NavigationHeader />
                  {children}
                </ThemeProvider>
              </I18nProvider>
            </TRPCProvider>
          </ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}// Force rebuild
