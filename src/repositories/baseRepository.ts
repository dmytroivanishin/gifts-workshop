import { PaginationOptions } from "@/types";
import { InternalServerError } from "@/common/errors/internalServer";

export const repositoryRegistry: Record<string, any> = {};

export function registerRepository(name: string, repo: any) {
  repositoryRegistry[name] = repo;
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

  protected async populate(item: T): Promise<TPopulated> {
    return item as unknown as TPopulated;
  }

  protected serialize(item: any): T {
    return item as T;
  }

  async getAll(options?: PaginationOptions): Promise<TPopulated[]> {
    let url = this.getUrl();
    if (options?.page || options?.limit) {
      const params = new URLSearchParams();
      if (options.page) params.append("_page", options.page.toString());
      if (options.limit) params.append("_per_page", options.limit.toString());
      url += `?${params.toString()}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch all from ${this.collectionName}`);
    }

    const data = await res.json();
    const rawItems: T[] = Array.isArray(data) ? data : data.data || [];
    return Promise.all(rawItems.map(item => this.populate(item)));
  }

  async getById(id: string): Promise<TPopulated | undefined> {
    const res = await fetch(this.getUrl(id), { cache: "no-store" });
    if (res.status === 404) return undefined;
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch by id from ${this.collectionName}`);
    }
    const raw = await res.json();
    return this.populate(raw);
  }

  async getByQuery(query: Record<string, any>, options?: PaginationOptions): Promise<TPopulated[]> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    if (options?.page) params.append("_page", options.page.toString());
    if (options?.limit) params.append("_per_page", options.limit.toString());

    const queryString = params.toString();
    const url = `${this.getUrl()}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch by query from ${this.collectionName}`);
    }

    const data = await res.json();
    const rawItems: T[] = Array.isArray(data) ? data : data.data || [];
    return Promise.all(rawItems.map(item => this.populate(item)));
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
