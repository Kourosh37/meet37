"use client";

export function DisplayNameInput({
  error,
  onChange,
  value
}: {
  error?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <label
        className="text-sm font-medium text-surface-foreground"
        htmlFor="display-name"
      >
        Display name
      </label>
      <input
        autoComplete="name"
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
        id="display-name"
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
