"use client";

import { useTranslation } from "@/i18n";
import { cn } from "@/utils/cn";

interface InStockRibbonProps {
  className?: string;
}

// A flat bookmark with a folded-back right flap, drawn after a reference bookmark icon: the body has a
// rounded top-left corner and a swallowtail cut at the bottom, and the darker flap (the ribbon's
// underside) is a short half-rounded strip at the top-right that tucks under the body. Colours come from
// the Lime palette (docs/project-plan/colors.md): 300 for the front (the "in stock" filter's green),
// 400 for the underside, 600 for the label; the label uses the project font (Inter, --font-sans).
// It sizes itself from the card's width (a share of it, with a floor and a cap) so it stays in proportion
// from a phone's single column to a wide 3-column grid, and it is lifted by the flap's height (13 of the
// 140 units, 9.3%) so the flap sits above the card and its lower end meets the card's top edge, with the
// body hanging down over the photo. The parent must be `relative` and not clip overflow.
// Pure SVG; the label is real text (localised via t()) rotated to read top to bottom.
export function InStockRibbon({ className }: InStockRibbonProps) {
  const { t } = useTranslation();
  const label = t("in_stock");

  return (
    <svg
      viewBox="0 0 64 140"
      role="img"
      aria-label={label}
      className={cn(
        "pointer-events-none absolute top-0 left-[4.5%] z-20 h-auto w-[11%] min-w-10 max-w-[52px] -translate-y-[9.3%] overflow-visible md:w-[13%]",
        "drop-shadow-[0_1px_2px_rgba(40,50,20,0.2)]",
        className
      )}
    >
      {/* Body: rounded top-left corner, swallowtail bottom. Its right edge runs up under the flap. */}
      <path
        d="M0 14 A14 14 0 0 1 14 0 H55 V13 H46 V140 L23 124 L0 140 Z"
        style={{ fill: "var(--color-lime-active)" }} /* Lime 300 #DADFC6 */
      />
      {/* Folded-back flap (underside) on the right: semicircular top, drawn over the body's right edge */}
      <path
        d="M64 13 V9 A9 9 0 0 0 46 9 V13 Z"
        fill="#B1BB7E" /* Lime 400 — the palette step just darker than the front */
      />
      {/* Centred in the part that hangs below the card edge (y 13 to the swallowtail notch at y 124) */}
      <text
        transform="translate(23 69) rotate(90)"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="600"
        letterSpacing="0.5"
        style={{ fill: "var(--color-lime-text)", fontFamily: "var(--font-sans)" }} /* Lime 600 #5C6535, Inter */
      >
        {label}
      </text>
    </svg>
  );
}
