import { ISystemTextRepository } from "@/repositories/interfaces";
import { ISystemTextService } from "./interfaces";
import { SystemText, PaginatedResult } from "@/types";
import { paginate } from "./pagination";

export class SystemTextService implements ISystemTextService {
  constructor(private systemTextRepo: ISystemTextRepository) {}

  async getAllSystemTexts(options?: any): Promise<PaginatedResult<SystemText>> {
    const page = options?.page || 1;
    const limit = options?.limit || 100;

    const allTexts = await this.systemTextRepo.getAll();
    
    // Slice to limit + 1 so paginate can detect if there's a next page
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
      content: typeof body.content === "string" ? { ru: body.content, en: "" } : body.content,
    };
    return this.systemTextRepo.save(text);
  }

  async deleteSystemText(id: string): Promise<boolean> {
    return this.systemTextRepo.delete(id);
  }
}
