import { sendSuccess, withErrorHandling } from "@/utils/apiResponse";
import { IUserService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

export class UserController {
  constructor(private userService: IUserService) {}

  getUsers = withErrorHandling(async (request: Request) => {
    const result = await this.userService.getAllUsers();
    return sendSuccess(result.data, result.meta);
  });

  getUserById = withErrorHandling(async (request: Request, id: string) => {
    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return sendSuccess(user);
  });
}


