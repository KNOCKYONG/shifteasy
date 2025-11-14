import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { SSEProvider } from "@/providers/SSEProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NavigationHeader } from "@/components/layout/NavigationHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShiftEasy - Smart Shift Management",
  description: "Intelligent shift scheduling for healthcare, manufacturing, and service industries",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <SupabaseProvider initialSession={session}>
          <ErrorBoundary>
            <TRPCProvider>
              <I18nProvider>
                <SSEProvider>
                  <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange={false}
                  >
                    <NavigationHeader />
                    {children}
                  </ThemeProvider>
                </SSEProvider>
              </I18nProvider>
            </TRPCProvider>
          </ErrorBoundary>
        </SupabaseProvider>
      </body>
    </html>
  );
}// Force rebuild
