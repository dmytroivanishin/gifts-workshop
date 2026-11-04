import { drizzleDatabase } from "./database";
import { eq, inArray, sql, SQL } from "drizzle-orm";
import { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { IBaseRepository } from "../interfaces";
import { PaginationOptions } from "@/types";
import { isUUID } from "@/utils/uuid";

export abstract class DrizzleBaseRepository<
  T extends { id: string },
  TPopulated = T,
  TQueryOptions extends PaginationOptions = PaginationOptions
> implements IBaseRepository<T, TPopulated, TQueryOptions> {

  constructor(protected table: PgTable & { id: AnyPgColumn }) {}

  // Abstract method every concrete repository must implement to map raw DB records to the populated TypeScript model;
  // each subclass overrides with its own table's concrete Drizzle row type (e.g. `typeof users.$inferSelect`).
  abstract populate(item: Record<string, unknown>): Promise<TPopulated>;

  // Hooks a subclass overrides to add ordering/filtering to getAll() without reimplementing its
  // limit/offset/page application. Defaults are no-ops (no order, no filter), matching the
  // original behavior for any repository that doesn't need either.
  protected getOrderBy(): SQL | AnyPgColumn | undefined {
    return undefined;
  }

  protected buildFilter(_options?: TQueryOptions): SQL | undefined {
    return undefined;
  }

  async getAll(options?: TQueryOptions): Promise<TPopulated[]> {
    let query = drizzleDatabase.getDb().select().from(this.table).$dynamic();

    const filter = this.buildFilter(options);
    if (filter) {
      query = query.where(filter);
    }

    const order = this.getOrderBy();
    if (order) {
      query = query.orderBy(order);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset !== undefined) {
      query = query.offset(options.offset);
    } else if (options?.page && options?.limit) {
      query = query.offset((options.page - 1) * options.limit);
    }

    const records = await query;
    return Promise.all(records.map(r => this.populate(r)));
  }

  async getById(id: string): Promise<TPopulated | undefined> {
    // A non-UUID id can never match a uuid primary key; short-circuit instead of letting
    // Postgres throw "invalid input syntax for type uuid" (which would surface as a 500).
    if (!isUUID(id)) return undefined;
    const records = await drizzleDatabase.getDb().select().from(this.table).where(eq(this.table.id, id)).limit(1);
    if (!records.length) return undefined;
    return this.populate(records[0]);
  }

  async getByIds(ids: string[]): Promise<TPopulated[]> {
    const validIds = ids.filter(isUUID);
    if (!validIds.length) return [];
    const records = await drizzleDatabase.getDb().select().from(this.table).where(inArray(this.table.id, validIds));
    return Promise.all(records.map(r => this.populate(r)));
  }

  async save(item: T): Promise<TPopulated> {
    const existing = await drizzleDatabase.getDb().select({ id: this.table.id }).from(this.table).where(eq(this.table.id, item.id)).limit(1);
    
    let record;
    if (existing.length) {
      const [updated] = await drizzleDatabase.getDb().update(this.table).set(item).where(eq(this.table.id, item.id)).returning();
      record = updated;
    } else {
      const [inserted] = await drizzleDatabase.getDb().insert(this.table).values(item).returning();
      record = inserted;
    }
    
    return this.populate(record);
  }

  async saveMany(items: T[]): Promise<TPopulated[]> {
    if (!items.length) return [];

    // Dynamically construct update block for bulk upsert (ON CONFLICT DO UPDATE)
    const keys = Object.keys(items[0]).filter(k => k !== "id");
    const updateSet = keys.reduce((acc, key) => {
      const dbColumnName = (this.table as unknown as Record<string, AnyPgColumn>)[key]?.name || key;
      acc[key] = sql`excluded.${sql.identifier(dbColumnName)}`;
      return acc;
    }, {} as Record<string, ReturnType<typeof sql>>);

    const records = await drizzleDatabase.getDb()
      .insert(this.table)
      .values(items as any)
      .onConflictDoUpdate({
        target: this.table.id,
        set: updateSet
      })
      .returning();

    return Promise.all(records.map(r => this.populate(r)));
  }

  async delete(id: string): Promise<boolean> {
    if (!isUUID(id)) return false;
    const result = await drizzleDatabase.getDb().delete(this.table).where(eq(this.table.id, id)).returning({ id: this.table.id });
    return result.length > 0;
  }
}
