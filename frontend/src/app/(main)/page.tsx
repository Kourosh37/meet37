import { BrandMark } from "@/components/layout/BrandMark";
import { ArrowRight, LogIn, Video } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-4xl flex-col justify-center py-10">
      <div className="space-y-7">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
          <BrandMark className="h-10 w-10" size={40} />
          <span className="text-base font-semibold text-surface-foreground">
            meet37
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground">
          <Video className="size-4 text-primary" />
          Browser meetings
        </div>
        <div className="space-y-5">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-6xl">
            Start a meeting and share the link.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Create a room in seconds, enter with a display name, and keep the
            meeting controls focused on the call.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            Create room
            <ArrowRight className="size-4" />
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-surface-foreground transition hover:bg-muted"
            href="/login"
          >
            <LogIn className="size-4" />
            Login
          </Link>
        </div>
      </div>
    </section>
  );
}
