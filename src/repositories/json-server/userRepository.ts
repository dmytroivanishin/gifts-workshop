import { BaseRepository, registerRepository } from "./baseRepository";
import { IUserRepository } from "../interfaces";
import { User } from "@/types";

export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor() {
    super("users");
    registerRepository("users", this);
  }

  async getByEmail(email: string): Promise<User | undefined> {
    const recs = await this.getByQuery({ email });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }
}
