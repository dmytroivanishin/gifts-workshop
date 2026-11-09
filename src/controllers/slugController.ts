import { z } from "zod";
import { sendSuccess, withErrorHandling } from "@/utils/apiResponse";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { generateSlug } from "@/utils/slug";

const slugRequestSchema = z.object({
  text: z.string().max(300, "error_too_long"),
});

// Turns a title into a URL slug (translating it to English first, with a transliteration fallback)
// so the admin forms can show the address while the title is still being typed. It only suggests:
// uniqueness is still decided by the service that saves the entity.
export class SlugController {
  generateSlug = withErrorHandling(async (request: Request) => {
    const { text } = await validateRequest(slugRequestSchema, await parseJsonBody(request));
    const slug = text.trim() ? await generateSlug(text.trim()) : "";
    return sendSuccess({ slug });
  });
}
