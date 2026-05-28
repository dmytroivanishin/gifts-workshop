import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ICollectionService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";

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

  async saveCollection(request: Request, id?: string) {
    try {
      const body = await request.json();
      if (id) {
        body.id = await resolveId(id, (slug) => this.collectionService.getCollectionBySlug(slug));
      }
      const collection = await this.collectionService.saveCollection(body);
      return sendSuccess(collection);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteCollection(request: Request, id: string) {
    try {
      const resolvedId = await resolveId(id, (slug) => this.collectionService.getCollectionBySlug(slug));
      const success = await this.collectionService.deleteCollection(resolvedId);
      if (!success) {
        throw new NotFoundError("Collection not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}


