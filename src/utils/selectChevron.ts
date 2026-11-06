import { CSSProperties } from "react";

// A native <select>'s own dropdown arrow sits flush against the browser's default inner edge,
// with no way to add margin via padding. This replaces it with a custom chevron (appearance:
// none + a background-image svg) so every admin <select> gets consistent breathing room from
// its right edge, matching the shared Combobox component's own chevron spacing.
export const SELECT_CHEVRON_STYLE: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23827C6B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 1rem center",
  backgroundSize: "14px",
  paddingRight: "2.5rem",
};
