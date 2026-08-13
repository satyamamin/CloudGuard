import { ClerkProvider, OrganizationSwitcher, Show, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/product-name";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "Azure cost management for the EU market",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900">
          <Show when="signed-in">
            <div className="flex justify-end items-center gap-3 p-4">
              <OrganizationSwitcher hidePersonal />
              <UserButton />
            </div>
          </Show>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
