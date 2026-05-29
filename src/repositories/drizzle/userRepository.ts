import { DrizzleBaseRepository } from "./baseRepository";
import { users } from "./schema";
import { User } from "@/types";
import { drizzleDatabase } from "./database";
import { eq } from "drizzle-orm";
import { IUserRepository } from "../interfaces";

export class UserRepository extends DrizzleBaseRepository<User, User> implements IUserRepository {
  constructor() {
    super(users as any);
  }

  async populate(item: any): Promise<User> {
    return item as User;
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const records = await drizzleDatabase.getDb().select().from(users).where(eq(users.email, email)).limit(1);
    return records.length ? this.populate(records[0]) : undefined;
  }
}

export const userRepository = new UserRepository();
