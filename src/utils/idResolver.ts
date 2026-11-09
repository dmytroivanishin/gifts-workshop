import { isUUID } from "@/utils/uuid";
import { ValidationError } from "@/common/errors/validation";

// Each slug in the list is its own database lookup, so a public caller must not be able to send hundreds.
export const MAX_MULTI_IDS = 10;

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
 * Runs lookup calls concurrently; more than MAX_MULTI_IDS values is a 400, not that many queries.
 */
export async function resolveMultipleIds<T extends { id: string }>(
  value: string,
  getBySlug: (slug: string) => Promise<T | undefined>
): Promise<string[]> {
  const parts = value.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length > MAX_MULTI_IDS) {
    throw new ValidationError(`Too many values: at most ${MAX_MULTI_IDS} are allowed.`);
  }
  return Promise.all(parts.map(part => resolveId(part, getBySlug)));
}
