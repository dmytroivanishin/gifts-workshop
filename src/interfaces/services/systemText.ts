import type { PaginatedResult, SystemText } from "@/types";
import type { QueryOptions } from "../query";

export interface ISystemTextService {
  getAllSystemTexts(options?: QueryOptions): Promise<PaginatedResult<SystemText>>;
  getSystemTextById(id: string): Promise<SystemText | undefined>;
  // Loosely typed on purpose: the controller's inline Zod schema validates a field named `id`
  // (the text's code), but the implementation also reads `body.code` — which that schema never
  // actually produces. Tightening this surfaces that mismatch rather than just annotating it.
  saveSystemText(body: any): Promise<SystemText>;
  deleteSystemText(id: string): Promise<boolean>;
}
