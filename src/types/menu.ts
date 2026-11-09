import { LocalizedText } from "@/types";

// What the public header and footer need to link to an info page: just the address and the title.
export interface MenuPage {
  slug: string;
  title: LocalizedText;
}
