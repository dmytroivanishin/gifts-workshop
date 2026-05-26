import { sendSuccess, sendError } from "@/lib/apiResponse";
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

  async saveUser(request: Request) {
    try {
      const body = await request.json();
      const user = await this.userService.saveUser(body);
      return sendSuccess(user);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteUser(request: Request, id: string) {
    try {
      const success = await this.userService.deleteUser(id);
      if (!success) {
        throw new NotFoundError("User not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}
