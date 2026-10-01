import { userController } from "@/modules/core/container";

export async function GET(request: Request) {
  return userController.getUsers(request);
}
