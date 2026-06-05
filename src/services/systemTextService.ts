import { ISystemTextRepository, QueryOptions } from "@/repositories/interfaces";
import { ISystemTextService } from "./interfaces";
import { SystemText, PaginatedResult } from "@/types";
import { paginate } from "./pagination";

export class SystemTextService implements ISystemTextService {
  constructor(private systemTextRepo: ISystemTextRepository) {}

  async getAllSystemTexts(options?: QueryOptions): Promise<PaginatedResult<SystemText>> {
    const page = options?.page || 1;
    const limit = options?.limit || 100;
    
    // Note: To properly support pagination locally in memory, we fetch one extra
    // to let `paginate` know if there is a next page. If options.area is used, 
    // it filters at DB level. Then we slice it.
    const allTexts = await this.systemTextRepo.getAll(options);
    
    const startIndex = (page - 1) * limit;
    const textsForPage = allTexts.slice(startIndex, startIndex + limit + 1);

    return paginate(textsForPage, { page, limit });
  }

  async getSystemTextById(id: string): Promise<SystemText | undefined> {
    return this.systemTextRepo.getById(id);
  }

  async saveSystemText(body: any): Promise<SystemText> {
    const text: SystemText = {
      id: body.id, // ID must be provided (e.g. 'save', 'cancel')
      content: body.content,
      area: body.area || "public",
    };
    return this.systemTextRepo.save(text);
  }

  async deleteSystemText(id: string): Promise<boolean> {
    return this.systemTextRepo.delete(id);
  }
}
