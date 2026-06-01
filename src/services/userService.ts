import { IUserRepository } from "@/repositories/interfaces";
import { IUserService } from "./interfaces";
import { User } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class UserService implements IUserService {
  constructor(private userRepo: IUserRepository) {}

  async getAllUsers(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const users = await this.userRepo.getAll({
      page,
      limit: limit + 1,
      offset: (page - 1) * limit,
    });

    return paginate(users, { page, limit });
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.userRepo.getById(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.userRepo.getByEmail(email);
  }

  async saveUser(body: any): Promise<User> {
    const id = body.id || randomUUID();
    const user: User = {
      id,
      email: body.email,
      name: body.name,
    };
    return this.userRepo.save(user);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userRepo.delete(id);
  }
}
