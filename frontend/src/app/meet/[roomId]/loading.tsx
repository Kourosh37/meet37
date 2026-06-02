export default function MeetingLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="aspect-video animate-pulse rounded-lg border border-border bg-muted" />
        <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded bg-muted" />
          <div className="h-11 animate-pulse rounded bg-muted" />
        </div>
      </section>
    </main>
  );
}
