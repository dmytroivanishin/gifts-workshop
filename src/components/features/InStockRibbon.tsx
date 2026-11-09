"use client";

import { useId } from "react";
import { useTranslation } from "@/i18n";
import { cn } from "@/utils/cn";

interface InStockRibbonProps {
  className?: string;
}

// A bookmark ribbon with a folded-back right flap: the body has a rounded top-left corner and a swallowtail
// cut at the bottom, and the dark flap (the ribbon's underside) is a short half-rounded strip at the
// top-right that tucks under the body. It is deliberately the one saturated, off-palette element on the
// card (a fresh leaf green, not the site's muted Lime) so it catches the eye on light photos as well as
// dark ones: the body runs from a bright green at the top, with a white-to-warm-yellow glint on the fold,
// to a deeper green at the tail; the flap is a flat dark green; the label is white.
// It sizes itself from the card's width (a share of it, with a floor and a cap) so it stays in proportion
// from a phone's single column to a wide 3-column grid, and it is lifted by the flap's height (13 of the
// 140 units, 9.3%) so the flap sits above the card and its lower end meets the card's top edge, with the
// body hanging down over the photo. The parent must be `relative` and not clip overflow.
// The shadow is a blurred copy of the body clipped at the card's top edge (y = 13), so it falls only on the
// photo under the ribbon and never above the card. Pure SVG; the label is real text (localised via t())
// rotated to read top to bottom.
const BODY_PATH = "M0 14 A14 14 0 0 1 14 0 H55 V13 H46 V140 L23 124 L0 140 Z";
const FLAP_PATH = "M64 13 V9 A9 9 0 0 0 46 9 V13 Z";
const CARD_EDGE_Y = 13;

export function InStockRibbon({ className }: InStockRibbonProps) {
  const { t } = useTranslation();
  const label = t("in_stock");
  const uid = useId().replace(/:/g, "");
  const gradientId = `ribbon-fill-${uid}`;
  const glintId = `ribbon-glint-${uid}`;
  const blurId = `ribbon-blur-${uid}`;
  const sheenBlurId = `ribbon-sheen-blur-${uid}`;
  const shadowClipId = `ribbon-clip-${uid}`;
  const bodyClipId = `ribbon-body-${uid}`;

  return (
    <svg
      viewBox="0 0 64 140"
      role="img"
      aria-label={label}
      className={cn(
        "pointer-events-none absolute top-0 left-[4.5%] z-20 h-auto w-[11%] min-w-10 max-w-[52px] -translate-y-[9.3%] overflow-visible md:w-[13%]",
        className
      )}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9AD24E" />
          <stop offset="1" stopColor="#3F8A22" />
        </linearGradient>
        {/* The glint sits on the fold at the very top of the ribbon and fades out downwards */}
        <linearGradient id={glintId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="0.35" stopColor="#FFF3A6" stopOpacity="0.4" />
          <stop offset="1" stopColor="#FFF3A6" stopOpacity="0" />
        </linearGradient>
        <clipPath id={bodyClipId}>
          <path d={BODY_PATH} />
        </clipPath>
        <filter id={sheenBlurId} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        {/* Everything above the card's top edge is cut away, so the shadow starts at the card. */}
        <clipPath id={shadowClipId}>
          <rect x="-20" y={CARD_EDGE_Y} width="110" height="200" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${shadowClipId})`}>
        <path
          d={BODY_PATH}
          transform="translate(2 3)"
          filter={`url(#${blurId})`}
          fill="rgba(25, 45, 10, 0.42)"
        />
      </g>

      {/* Body: rounded top-left corner, swallowtail bottom. Its right edge runs up under the flap. */}
      <path d={BODY_PATH} fill={`url(#${gradientId})`} />
      {/* A thin light edge keeps the ribbon crisp against dark photos */}
      <path d={BODY_PATH} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <g clipPath={`url(#${bodyClipId})`}>
        <rect x="0" y="0" width="64" height="30" fill={`url(#${glintId})`} />
        {/* Two slightly blurred horizontal glints at the very top, on top of the gradient glint */}
        <g filter={`url(#${sheenBlurId})`}>
          <rect x="0" y="3.5" width="64" height="2" fill="#FFF8C4" fillOpacity="0.8" />
          <rect x="0" y="7.3" width="64" height="1.2" fill="#FFF8C4" fillOpacity="0.6" />
        </g>
      </g>
      {/* Folded-back flap (underside) on the right: flat dark green, semicircular top, drawn over the body's right edge */}
      <path d={FLAP_PATH} fill="#37771A" />
      {/* Centred in the part that hangs below the card edge (y 13 to the swallowtail notch at y 124) */}
      <text
        transform="translate(23 69) rotate(90)"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15.5"
        fontWeight="700"
        letterSpacing="0.5"
        fill="#FFFFFF"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {label}
      </text>
    </svg>
  );
}
