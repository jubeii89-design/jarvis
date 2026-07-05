import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-jarvis-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "J.A.R.V.I.S. — Just A Rather Very Intelligent System",
  description: "An advanced AI assistant with 4-tier memory, web research, and ElevenLabs voice. Modeled on the iconic Marvel Cinematic Universe character.",
  keywords: ["JARVIS", "AI Assistant", "Iron Man", "MCU", "Claude", "ElevenLabs", "Memory Architecture"],
  authors: [{ name: "Stark Industries" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "J.A.R.V.I.S. — AI Assistant",
    description: "Advanced AI assistant with 4-tier memory, web research, and voice synthesis.",
    url: "https://chat.z.ai",
    siteName: "J.A.R.V.I.S.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
