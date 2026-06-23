/**
 * Splits text on a single separator and re-attaches that separator to the end of
 * every part except the last, dropping blank parts; the per-level split step
 * recursiveSplit applies as it walks the separator hierarchy.
 */
export function splitBySeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  // Re-attach separator to end of each part (except last)
  return parts
    .map((part, i) => (i < parts.length - 1 ? part + separator : part))
    .filter((part) => part.trim().length > 0);
}
