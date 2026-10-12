import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { ICollectionService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { collectionSchema } from "@/common/validation/schemas";
import { getUserId } from "@/utils/auth";
import { getPaginationParams } from "@/utils/paginationUtils";

export class CollectionController {
  constructor(private collectionService: ICollectionService) {}

  getCollections = withErrorHandling(async (request: Request) => {
    const { page, limit } = getPaginationParams(request);
    const result = await this.collectionService.getAllCollections({ page, limit });
    return sendSuccess(result.data, result.meta, CACHE_SECONDS.lookup);
  });

  getCollectionById = withErrorHandling(async (request: Request, id: string) => {
    const collection = await this.collectionService.getCollectionById(id);
    if (!collection) {
      throw new NotFoundError("Collection not found");
    }
    return sendSuccess(collection, undefined, CACHE_SECONDS.lookup);
  });

  saveCollection = withErrorHandling(async (request: Request, id?: string) => {
    const rawBody: any = await parseJsonBody(request);
    if (id) {
      rawBody.id = await resolveId(id, (slug) => this.collectionService.getCollectionBySlug(slug));
    }
    const body = await validateRequest(collectionSchema.extend({ id: z.string().uuid().optional() }), rawBody);
    const userId = await getUserId();
    const collection = await this.collectionService.saveCollection({ ...body, userId } as any);
    return sendSuccess(collection);
  });

  deleteCollection = withErrorHandling(async (request: Request, id: string) => {
    const resolvedId = await resolveId(id, (slug) => this.collectionService.getCollectionBySlug(slug));
    const success = await this.collectionService.deleteCollection(resolvedId);
    if (!success) {
      throw new NotFoundError("Collection not found");
    }
    return sendSuccess({ success: true });
  });
}


