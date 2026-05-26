import { userController } from "@/lib/container";

export async function GET(request: Request) {
  return userController.getUsers(request);
}

export async function POST(request: Request) {
  return userController.saveUser(request);
}
