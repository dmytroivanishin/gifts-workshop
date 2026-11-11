import type { Language, PaginatedResult, PaginationOptions } from "@/types";

export interface ILanguageService {
  getAllLanguages(options?: PaginationOptions): Promise<PaginatedResult<Language>>;
  getLanguageById(id: string): Promise<Language | undefined>;
  getLanguageByCode(code: string): Promise<Language | undefined>;
  saveLanguage(body: any): Promise<Language>;
  deleteLanguage(id: string): Promise<boolean>;
}
