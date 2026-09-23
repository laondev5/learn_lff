import type { Metadata } from "next"
import { Montserrat, Poppins } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "LFF Learning Management System",
  description: "LFF LMS — Empowering learners one lesson at a time",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${montserrat.variable} h-full`}
    >
      <body className="min-h-full bg-background font-sans antialiased text-foreground">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
