import { BaseRepository, registerRepository } from "./baseRepository";
import { IMediaRepository } from "../interfaces";
import { Media } from "@/types";

export class MediaRepository extends BaseRepository<Media> implements IMediaRepository {
  constructor() {
    super("media");
    registerRepository("media", this);
  }
}
