import { isUUID } from "@/utils/uuid";

/**
 * Resolves an entity's ID from either a UUID or a slug string by calling a database/repository lookup function.
 * If the value is a valid UUID, it is returned directly.
 * Otherwise, the lookup function is called with the slug. If the entity is found, its ID is returned.
 * If not found, the original trimmed value is returned.
 */
export async function resolveId<T extends { id: string }>(
  value: string,
  getBySlug: (slug: string) => Promise<T | undefined>
): Promise<string> {
  const trimmed = value.trim();
  if (isUUID(trimmed)) {
    return trimmed;
  }
  const entity = await getBySlug(trimmed);
  return entity ? entity.id : trimmed;
}

/**
 * Resolves multiple IDs from a comma-separated string of UUIDs/slugs.
 * Runs lookup calls concurrently.
 */
export async function resolveMultipleIds<T extends { id: string }>(
  value: string,
  getBySlug: (slug: string) => Promise<T | undefined>
): Promise<string[]> {
  const parts = value.split(",").map(p => p.trim()).filter(Boolean);
  return Promise.all(parts.map(part => resolveId(part, getBySlug)));
}
