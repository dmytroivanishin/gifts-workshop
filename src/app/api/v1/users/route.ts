import { userController } from "@/modules/core/container";

export async function GET() {
  return userController.getUsers();
}
