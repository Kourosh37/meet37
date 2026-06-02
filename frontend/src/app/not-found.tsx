import { BrandMark } from "@/components/layout/BrandMark";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <BrandMark className="h-12 w-12" size={48} />
        </div>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This route does not exist in the meeting app.
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          href="/"
        >
          Go home
        </Link>
      </section>
    </main>
  );
}
