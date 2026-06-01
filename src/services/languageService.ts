import { ILanguageRepository } from "@/repositories/interfaces";
import { ILanguageService } from "./interfaces";
import { Language, PaginatedResult } from "@/types";
import { randomUUID } from "crypto";
import { paginate } from "./pagination";

export class LanguageService implements ILanguageService {
  constructor(private languageRepo: ILanguageRepository) {}

  async getAllLanguages(options?: any): Promise<PaginatedResult<Language>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const languages = await this.languageRepo.getAll();
    return paginate(languages, { page, limit });
  }

  async getLanguageById(id: string): Promise<Language | undefined> {
    return this.languageRepo.getById(id);
  }

  async getLanguageByCode(code: string): Promise<Language | undefined> {
    return this.languageRepo.getByCode(code);
  }

  async saveLanguage(body: any): Promise<Language> {
    const id = body.id || randomUUID();
    const language: Language = {
      id,
      code: body.code,
      name: body.name,
      isActive: body.isActive ?? true,
    };
    return this.languageRepo.save(language);
  }

  async deleteLanguage(id: string): Promise<boolean> {
    return this.languageRepo.delete(id);
  }
}
