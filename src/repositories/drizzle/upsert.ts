import { sql, SQL } from "drizzle-orm";
import { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

// SET clause for a bulk `ON CONFLICT DO UPDATE`: every field of the first row except the id takes the incoming value.
export function buildUpsertSet(table: PgTable, row: object): Record<string, SQL> {
  const columns = table as unknown as Record<string, AnyPgColumn>;
  const assignments: Record<string, SQL> = {};
  for (const key of Object.keys(row)) {
    if (key === "id") continue;
    assignments[key] = sql`excluded.${sql.identifier(columns[key]?.name || key)}`;
  }
  return assignments;
}

// What a "replace the tag list" save has to insert and delete, given what is stored and what is wanted.
export function diffIds(existingIds: string[], wantedIds: string[]): { toAdd: string[]; toRemove: string[] } {
  return {
    toAdd: wantedIds.filter((id) => !existingIds.includes(id)),
    toRemove: existingIds.filter((id) => !wantedIds.includes(id)),
  };
}
