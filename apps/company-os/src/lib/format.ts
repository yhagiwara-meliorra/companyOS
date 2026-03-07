export function formatRelativeDate(input?: string | null) {
  if (!input) return "-";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(input));
  } catch {
    return input;
  }
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
