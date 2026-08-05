"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/daily", label: "Daily costs" },
  { href: "/dashboard/by-service", label: "By service" },
  { href: "/dashboard/by-resource", label: "By resource" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-[var(--series-1)] text-white" : "text-[var(--text-secondary)] hover:bg-black/5",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
