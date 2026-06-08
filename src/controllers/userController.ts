import { z } from "zod";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { IUserService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/utils/validateRequest";
import { userSchema } from "@/common/validation/schemas";

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

  async saveUser(request: Request, id?: string) {
    try {
      const rawBody = await request.json();
      if (id) {
        rawBody.id = id;
      }
      const body = await validateRequest(userSchema.extend({ id: z.string().uuid().optional() }), rawBody);
      const user = await this.userService.saveUser(body as any);
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


