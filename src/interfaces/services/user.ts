import type { PaginatedResult, PaginationOptions, User } from "@/types";

export interface IUserService {
  getAllUsers(options?: PaginationOptions): Promise<PaginatedResult<User>>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
}
