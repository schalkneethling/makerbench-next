interface RawTagEntry {
  id: string | null;
  name: string | null;
}

/**
 * Parses aggregated tag JSON and removes null placeholder entries.
 */
export function parseAggregatedTags(
  tagsJson: string,
): Array<{ id: string; name: string }> {
  try {
    const parsed = JSON.parse(tagsJson) as Array<RawTagEntry | null>;
    return parsed.filter(
      (tag): tag is { id: string; name: string } =>
        tag !== null && tag.id !== null && tag.name !== null,
    );
  } catch {
    return [];
  }
}
