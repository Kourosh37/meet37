import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";

export default function MeetingLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid aspect-video place-items-center rounded-lg border border-border bg-muted">
          <LoadingSpinner
            className="text-primary"
            label="Loading meeting"
            size="lg"
          />
        </div>
        <div className="grid min-h-96 place-items-center rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
            <LoadingSpinner
              className="text-primary"
              label="Loading room"
              size="lg"
            />
            <p className="text-sm font-medium">Loading room</p>
          </div>
        </div>
      </section>
    </main>
  );
}
