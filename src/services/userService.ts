import { IUserRepository } from "@/repositories/interfaces";
import { IUserService } from "./interfaces";
import { User, PaginatedResult, PaginationOptions } from "@/types";

import { paginate } from "./pagination";

export class UserService implements IUserService {
  constructor(private userRepo: IUserRepository) {}

  async getAllUsers(options?: PaginationOptions): Promise<PaginatedResult<User>> {
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
}
