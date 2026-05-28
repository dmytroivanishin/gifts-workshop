import { PaginationOptions } from "@/types";
import { InternalServerError } from "@/common/errors/internalServer";
import { shouldPopulate, getSubPopulateString } from "@/utils/populate";
import { collectUniqueIds } from "@/utils/array";

export const repositoryRegistry: Record<string, any> = {};

export function registerRepository(name: string, repo: any) {
  repositoryRegistry[name] = repo;
}

export async function populateRelations<TItem, TPopulated>(
  items: TItem[],
  populateStr: string | undefined,
  config: Record<string, {
    repoName: string;
    idExtractor: (item: TItem) => string | undefined | null | (string | undefined | null)[];
    mapper: (item: TPopulated, resolvedItems: any[]) => void;
  }>
): Promise<TPopulated[]> {
  if (items.length === 0) return [];

  // Clone items to avoid direct mutation of input arrays
  const populatedList = items.map(item => ({ ...item } as any as TPopulated));

  // Group fields by repoName to batch fetch and avoid N+1 queries
  const repoGroups: Record<string, {
    fields: string[];
    idExtractors: ((item: TItem) => string | undefined | null | (string | undefined | null)[])[];
  }> = {};

  for (const [field, fieldConfig] of Object.entries(config)) {
    if (!shouldPopulate(field, populateStr)) continue;

    if (!repoGroups[fieldConfig.repoName]) {
      repoGroups[fieldConfig.repoName] = { fields: [], idExtractors: [] };
    }
    repoGroups[fieldConfig.repoName].fields.push(field);
    repoGroups[fieldConfig.repoName].idExtractors.push(fieldConfig.idExtractor);
  }

  // Fetch all related entities in parallel (grouped by repo to keep queries flat)
  const repoNames = Object.keys(repoGroups);
  const fetchPromises = repoNames.map(async (repoName) => {
    const group = repoGroups[repoName];
    const repo = repositoryRegistry[repoName];
    if (!repo) return { repoName, data: [] };

    // Batch extract unique IDs across all fields sharing this repository
    const allIds = collectUniqueIds(items, group.idExtractors);

    if (allIds.length === 0) return { repoName, data: [] };

    // Merge sub-populate strings for all fields mapping to this repository
    let subPopulateStr: string | undefined = undefined;
    if (populateStr !== undefined) {
      const allSubParts: string[] = [];
      for (const field of group.fields) {
        const sub = getSubPopulateString(field, populateStr);
        if (sub) {
          allSubParts.push(...sub.split(","));
        }
      }
      if (allSubParts.length > 0) {
        subPopulateStr = Array.from(new Set(allSubParts)).join(",");
      }
    }

    const options = subPopulateStr ? { populate: subPopulateStr } : undefined;
    const resolved = await repo.getByIds(allIds, options);
    return { repoName, data: resolved || [] };
  });

  const fetchResults = await Promise.all(fetchPromises);
  const resolvedDataByRepo = fetchResults.reduce((acc, curr) => {
    acc[curr.repoName] = curr.data;
    return acc;
  }, {} as Record<string, any[]>);

  // Apply declarative mapping for each item
  for (const populatedItem of populatedList) {
    const originalItem = items[populatedList.indexOf(populatedItem)];

    for (const [field, fieldConfig] of Object.entries(config)) {
      const isFieldPopulated = shouldPopulate(field, populateStr);
      const resolvedItems = isFieldPopulated ? (resolvedDataByRepo[fieldConfig.repoName] || []) : [];
      fieldConfig.mapper(populatedItem, resolvedItems);
    }
  }

  return populatedList;
}

export class Database {
  private static uri: string = "http://localhost:3001";
  private static isConnected: boolean = false;

  static async connect(
    uri: string,
    options?: {
      port?: string | number;
      dbName?: string;
      user?: string;
      password?: string;
    }
  ): Promise<void> {
    let baseUrl = (uri || "http://localhost").replace(/^['"]|['"]$/g, "");
    const port = options?.port ? String(options.port).replace(/^['"]|['"]$/g, "") : undefined;

    if (port) {
      const cleanUri = baseUrl.replace(/\/$/, "");
      const hasPort = /:\d+/.test(cleanUri.replace(/^https?:\/\//, ""));
      if (!hasPort) {
        baseUrl = `${cleanUri}:${port}`;
      }
    }

    Database.uri = baseUrl;
    Database.isConnected = true;
    console.log(`[Database] Connected successfully. Base URL: ${Database.uri}`);
  }

  static getUri(): string {
    return Database.uri;
  }

  static getIsConnected(): boolean {
    return Database.isConnected;
  }
}

export class BaseRepository<T extends { id: string }, TPopulated = T> {
  constructor(protected collectionName: string) { }

  protected getUrl(id?: string): string {
    const base = Database.getUri();
    return id ? `${base}/${this.collectionName}/${id}` : `${base}/${this.collectionName}`;
  }

  protected async populate(item: T, options?: { populate?: string }): Promise<TPopulated> {
    return item as unknown as TPopulated;
  }

  protected async populateMany(items: T[], options?: { populate?: string }): Promise<TPopulated[]> {
    return Promise.all(items.map(item => this.populate(item, options)));
  }

  protected serialize(item: any): T {
    return item as T;
  }

  async getAll(options?: PaginationOptions & { populate?: string }): Promise<TPopulated[]> {
    let url = this.getUrl();
    if (options?.page || options?.limit) {
      const params = new URLSearchParams();
      if (options.page) params.append("_page", options.page.toString());
      if (options.limit) params.append("_limit", options.limit.toString());
      url += `?${params.toString()}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch all from ${this.collectionName}`);
    }

    const data = await res.json();
    const rawItems: T[] = Array.isArray(data) ? data : data.data || [];
    return this.populateMany(rawItems, options);
  }

  async getById(id: string, options?: { populate?: string }): Promise<TPopulated | undefined> {
    const res = await fetch(this.getUrl(id), { cache: "no-store" });
    if (res.status === 404) return undefined;
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch by id from ${this.collectionName}`);
    }
    const raw = await res.json();
    return this.populate(raw, options);
  }

  async getByIds(ids: string[], options?: { populate?: string }): Promise<TPopulated[]> {
    if (!ids || ids.length === 0) return [];
    const params = new URLSearchParams();
    ids.forEach(id => params.append("id", id));

    const res = await fetch(`${this.getUrl()}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch by ids from ${this.collectionName}`);
    }

    const data = await res.json();
    const rawItems: T[] = Array.isArray(data) ? data : data.data || [];
    return this.populateMany(rawItems, options);
  }

  async getByQuery(query: Record<string, any>, options?: PaginationOptions & { populate?: string }): Promise<TPopulated[]> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    if (options?.page) params.append("_page", options.page.toString());
    if (options?.limit) params.append("_limit", options.limit.toString());

    const queryString = params.toString();
    const url = `${this.getUrl()}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch by query from ${this.collectionName}`);
    }

    const data = await res.json();
    const rawItems: T[] = Array.isArray(data) ? data : data.data || [];
    return this.populateMany(rawItems, options);
  }

  async save(item: any): Promise<TPopulated> {
    const flatItem = this.serialize(item);
    const check = await fetch(this.getUrl(flatItem.id), { method: "GET", cache: "no-store" });
    let res;
    if (check.ok) {
      res = await fetch(this.getUrl(flatItem.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flatItem),
      });
    } else {
      res = await fetch(this.getUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flatItem),
      });
    }
    if (!res.ok) {
      throw new InternalServerError(`Failed to save item in ${this.collectionName}`);
    }
    const savedRaw = await res.json();
    return this.populate(savedRaw);
  }

  async delete(id: string): Promise<boolean> {
    const res = await fetch(this.getUrl(id), { method: "DELETE" });
    return res.ok;
  }
}
