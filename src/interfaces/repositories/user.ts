import type { User } from "@/types";
import type { IBaseRepository } from "./base";

export interface IUserRepository extends IBaseRepository<User> {
  getByEmail(email: string): Promise<User | undefined>;
}
