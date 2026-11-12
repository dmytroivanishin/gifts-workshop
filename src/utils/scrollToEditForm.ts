// On phones and tablets the form block sits above the list, so after "Edit" on a long list the form is off
// screen. Scroll it into view there. From lg up the form is beside the list and already visible, so no scroll.
const SIDE_BY_SIDE_MIN_WIDTH = "(min-width: 1024px)";

export function scrollToEditForm(formBlock: HTMLElement | null): void {
  if (!formBlock || typeof window === "undefined") return;
  if (window.matchMedia(SIDE_BY_SIDE_MIN_WIDTH).matches) return;
  formBlock.scrollIntoView({ behavior: "smooth", block: "start" });
}
