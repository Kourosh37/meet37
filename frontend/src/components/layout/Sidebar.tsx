import { BrandMark } from "@/components/layout/BrandMark";
import { Activity, Gauge, Settings, Users } from "lucide-react";
import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/rooms", label: "Rooms", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="border-b border-border bg-surface md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link
          className="inline-flex items-center gap-2 font-semibold text-surface-foreground"
          href="/"
        >
          <BrandMark className="h-8 w-8" />
          meet37 Admin
        </Link>
      </div>
      <nav
        aria-label="Admin navigation"
        className="flex gap-2 overflow-x-auto p-3 md:flex-col"
      >
        {adminLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
