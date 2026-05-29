import { BaseRepository, registerRepository } from "./baseRepository";
import { IColorRepository } from "../interfaces";
import { Color } from "@/types";

export class ColorRepository extends BaseRepository<Color> implements IColorRepository {
  constructor() {
    super("colors");
    registerRepository("colors", this);
  }
}
