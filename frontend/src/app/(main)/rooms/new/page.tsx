import { BrandMark } from "@/components/layout/BrandMark";
import Link from "next/link";
import { RoomCreationForm } from "@/features/rooms/components/RoomCreationForm";

export default function CreateRoomPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="mb-4 inline-flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 shadow-sm">
          <BrandMark className="h-8 w-8" />
          <p className="text-sm font-medium text-primary">Room setup</p>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          Create a room
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Create a shareable meeting link and keep host authority in this
          browser session.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <RoomCreationForm />
        <div className="mt-6">
          <Link
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
            href="/"
          >
            Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
