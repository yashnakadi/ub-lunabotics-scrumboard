import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { AuthProvider } from "@/providers/auth-provider";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Internal project management for the University at Buffalo NASA Lunabotics team.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
