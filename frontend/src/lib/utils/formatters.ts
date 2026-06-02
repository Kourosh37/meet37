const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto"
});

export function formatUnixSeconds(value: number) {
  return dateTimeFormatter.format(new Date(value * 1000));
}

export function formatRelativeUnixSeconds(value: number, now = Date.now()) {
  const diffSeconds = Math.round((value * 1000 - now) / 1000);
  const abs = Math.abs(diffSeconds);

  if (abs < 60) {
    return relativeTimeFormatter.format(diffSeconds, "second");
  }

  if (abs < 3_600) {
    return relativeTimeFormatter.format(Math.round(diffSeconds / 60), "minute");
  }

  if (abs < 86_400) {
    return relativeTimeFormatter.format(
      Math.round(diffSeconds / 3_600),
      "hour"
    );
  }

  return relativeTimeFormatter.format(Math.round(diffSeconds / 86_400), "day");
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

export function isUnixSecondsExpired(value: number, skewSeconds = 30) {
  return value * 1000 <= Date.now() + skewSeconds * 1000;
}
