import type { SystemText } from "@/types";
import type { QueryOptions } from "../query";
import type { IBaseRepository } from "./base";

export interface ISystemTextRepository extends IBaseRepository<SystemText, SystemText, QueryOptions> {}
