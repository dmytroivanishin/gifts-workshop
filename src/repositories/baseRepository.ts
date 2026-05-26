import { PaginationOptions } from "@/types";

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

export class BaseRepository<T extends { id: string }> {
  constructor(protected collectionName: string) { }

  protected getUrl(id?: string): string {
    const base = Database.getUri();
    return id ? `${base}/${this.collectionName}/${id}` : `${base}/${this.collectionName}`;
  }

  async getAll(options?: PaginationOptions): Promise<T[]> {
    let url = this.getUrl();
    if (options?.page || options?.limit) {
      const params = new URLSearchParams();
      if (options.page) params.append("_page", options.page.toString());
      if (options.limit) params.append("_per_page", options.limit.toString());
      url += `?${params.toString()}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch all from ${this.collectionName}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  }

  async getById(id: string): Promise<T | undefined> {
    const res = await fetch(this.getUrl(id), { cache: "no-store" });
    if (res.status === 404) return undefined;
    if (!res.ok) {
      throw new Error(`Failed to fetch by id from ${this.collectionName}`);
    }
    return res.json();
  }

  async getByQuery(query: Record<string, any>, options?: PaginationOptions): Promise<T[]> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      params.append(key, value.toString());
    });

    if (options?.page) params.append("_page", options.page.toString());
    if (options?.limit) params.append("_per_page", options.limit.toString());

    const queryString = params.toString();
    const url = `${this.getUrl()}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch by query from ${this.collectionName}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  }

  async save(item: T): Promise<T> {
    const check = await fetch(this.getUrl(item.id), { method: "GET", cache: "no-store" });
    let res;
    if (check.ok) {
      res = await fetch(this.getUrl(item.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    } else {
      res = await fetch(this.getUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
    }
    if (!res.ok) {
      throw new Error(`Failed to save item in ${this.collectionName}`);
    }
    return res.json();
  }

  async delete(id: string): Promise<boolean> {
    const res = await fetch(this.getUrl(id), { method: "DELETE" });
    return res.ok;
  }
}
