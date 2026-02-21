"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart3, Upload, List, Github, Mail, BookOpen } from "lucide-react";
import { SupportDialog } from "@/components/SupportDialog";

const allLinks = [
  { href: "/", label: "Upload", icon: Upload },
  { href: "/history", label: "History", icon: List },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/guide", label: "Guide", icon: BookOpen, guideOnly: true },
];

const guideEnabled = process.env.NEXT_PUBLIC_ENABLE_GUIDE === "true";
const links = allLinks.filter((l) => !l.guideOnly || guideEnabled);

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            Manassas Bill Tracker
          </span>
          <span className="hidden sm:inline text-xs text-muted-foreground border rounded-full px-2 py-0.5">
            Community Tool
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          <div className="flex items-center gap-1 border-r pr-4 mr-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Fetch-Systems-LLC/manassas-utilities"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="View on GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <SupportDialog>
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Contact Support"
              >
                <Mail className="h-5 w-5" />
              </button>
            </SupportDialog>
          </div>
        </nav>
      </div>
    </header>
  );
}
