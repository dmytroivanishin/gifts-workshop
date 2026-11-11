import type { Language } from "@/types";
import type { IBaseRepository } from "./base";

export interface ILanguageRepository extends IBaseRepository<Language> {
  getByCode(code: string): Promise<Language | undefined>;
}
