import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">
          Dashboard
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Admin data will be connected after auth and REST infrastructure are
          implemented.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["App mode", "Public/private toggle"],
          ["Live rooms", "Room stats"],
          ["SFU", "Relay metrics"]
        ].map(([title, detail]) => (
          <div
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
            key={title}
          >
            <h2 className="text-sm font-semibold text-surface-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <Link
        className="text-sm font-medium text-primary hover:text-primary/80"
        href="/admin/users"
      >
        Manage users
      </Link>
    </section>
  );
}
