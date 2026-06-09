import { useLocale } from "@/providers/LocaleProvider";

export function PasswordPrompt({
  onChange,
  value
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useLocale();

  return (
    <div className="space-y-2">
      <label
        className="text-sm font-medium text-surface-foreground"
        htmlFor="room-password"
      >
        {t("room.roomPassword")}
      </label>
      <input
        autoComplete="off"
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
        id="room-password"
        onChange={(event) => onChange(event.target.value)}
        type="password"
        value={value}
      />
    </div>
  );
}
