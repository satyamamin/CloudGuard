import { ClerkProvider, OrganizationSwitcher, SignedIn, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CloudGuard 360",
  description: "Azure cost management for the EU market",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900">
          <SignedIn>
            <div className="flex justify-end items-center gap-3 p-4">
              <OrganizationSwitcher hidePersonal />
              <UserButton />
            </div>
          </SignedIn>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
