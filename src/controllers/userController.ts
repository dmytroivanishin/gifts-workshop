import { sendSuccess, sendError } from "@/utils/apiResponse";
import { IUserService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

export class UserController {
  constructor(private userService: IUserService) {}

  async getUsers(request: Request) {
    try {
      const result = await this.userService.getAllUsers();
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getUserById(request: Request, id: string) {
    try {
      const user = await this.userService.getUserById(id);
      if (!user) {
        throw new NotFoundError("User not found");
      }
      return sendSuccess(user);
    } catch (error: any) {
      return sendError(error);
    }
  }
}


