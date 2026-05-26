import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ICollectionService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

export class CollectionController {
  constructor(private collectionService: ICollectionService) {}

  async getCollections(request: Request) {
    try {
      const result = await this.collectionService.getAllCollections();
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getCollectionById(request: Request, id: string) {
    try {
      const collection = await this.collectionService.getCollectionById(id);
      if (!collection) {
        throw new NotFoundError("Collection not found");
      }
      return sendSuccess(collection);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveCollection(request: Request) {
    try {
      const body = await request.json();
      const collection = await this.collectionService.saveCollection(body);
      return sendSuccess(collection);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteCollection(request: Request, id: string) {
    try {
      const success = await this.collectionService.deleteCollection(id);
      if (!success) {
        throw new NotFoundError("Collection not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}
