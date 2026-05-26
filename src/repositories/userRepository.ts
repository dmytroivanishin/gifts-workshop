import { BaseRepository } from "./baseRepository";
import { IUserRepository } from "./interfaces";
import { User } from "@/types";

export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor() {
    super("users");
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const all = await this.getAll();
    return all.find((u: User) => u.email === email);
  }
}
