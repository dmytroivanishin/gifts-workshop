# Theme Design (Shadcn UI Standard)

Based on the color palette defined in `colors.md` and the visual style from `starter_example.html`.

## Light Theme (Default)

```css
:root {
  /* Base Colors */
  --background: 30 11% 98%;    /* Tan 50 / #FAFAF9 */
  --foreground: 34 17% 10%;    /* Tan 900 / #1F1B16 */

  /* Card & Popover */
  --card: 30 11% 98%;          /* Tan 50 / #FAFAF9 */
  --card-foreground: 34 17% 10%;
  
  --popover: 0 0% 100%;
  --popover-foreground: 34 17% 10%;

  /* Primary (Core Brand Action) */
  --primary: 34 17% 10%;       /* Tan 900 - Dark Text/Main color as Primary */
  --primary-foreground: 30 11% 98%;

  /* Secondary */
  --secondary: 30 13% 91%;     /* Tan 200 / #EBE7E3 */
  --secondary-foreground: 34 17% 10%;

  /* Muted */
  --muted: 36 10% 93%;         /* Tan 100-ish / #F6F4F3 */
  --muted-foreground: 45 10% 46%; /* Ivory 500 / #827C6B */

  /* Accent (Hover states) */
  --accent: 30 13% 91%;        /* Tan 200 / #EBE7E3 */
  --accent-foreground: 34 17% 10%;

  /* Destructive */
  --destructive: 0 35% 42%;    /* Rose 600 / #8F4A4A */
  --destructive-foreground: 0 0% 100%;

  /* UI Elements */
  --border: 30 13% 91%;        /* Tan 200 / #EBE7E3 */
  --input: 30 13% 91%;
  --ring: 34 17% 10%;          /* Tan 900 */
  
  --radius: 0.75rem;           /* 12px as seen in starter_example */

  /* --- Custom Category Accents (from starter_example) --- */
  
  /* Toys / Favorites */
  --color-rose-bg: 0 25% 93%;      /* Rose 200 / #F1E7E7 */
  --color-rose-text: 0 32% 42%;    /* Rose 600 / #8F4A4A */
  --color-rose-muted: 0 35% 58%;   /* Rose 500 / #B87070 */
  
  /* Patchwork / In Stock */
  --color-lime-bg: 72 23% 92%;     /* Lime 200 / #EAECE0 */
  --color-lime-text: 71 31% 30%;   /* Lime 600 / #5C6535 */
  --color-lime-active: 72 26% 83%; /* Lime 300 / #DADFC6 */
  
  /* Composition */
  --color-tan-bg: 30 13% 91%;      /* Tan 200 / #EBE7E3 */
  --color-tan-text: 32 22% 32%;    /* Tan 600 / #63523F */
  
  /* Textile */
  --color-sand-bg: 38 13% 90%;     /* Sand 200 / #EAE7E2 */
  --color-sand-text: 43 19% 29%;   /* Sand 600 / #59513C */
  
  /* Doll Clothing */
  --color-brown-bg: 9 17% 92%;     /* Brown 200 / #EFE9E8 */
  --color-brown-text: 9 23% 42%;   /* Brown 600 / #835952 */
  
  /* Accessories */
  --color-orange-bg: 26 71% 91%;   /* Orange 200 / #F9E4D3 */
  --color-orange-text: 28 92% 29%; /* Orange 600 / #904504 */
  
  /* Knitting */
  --color-teal-bg: 180 34% 90%;    /* Teal 200 / #D8EFEF */
  --color-teal-text: 180 53% 25%;  /* Teal 600 / #1E6262 */
  
  /* New / In Stock (Alt) */
  --color-olive-bg: 60 4% 91%;     /* Olive 200 / #E7E7E5 */
  --color-olive-text: 48 6% 30%;   /* Olive 600 / #504E47 */

  /* Social/Heart */
  --heart-outline: 0 31% 73%;      /* Rose 400 / #D0A3A3 */
  --heart-active: 0 35% 58%;       /* Rose 500 / #B87070 */
}
```

## Category Color System (Pastel Palette)

To ensure consistency when adding new pastel categories, use the following color selection rules (based on `colors.md`):

### Formula for New Categories
1.  **Background (BG)**: Use shade **200** from the palette.
    *   *Characteristics*: Saturation 10-35%, Lightness 90-94%.
2.  **Text**: Use shade **600** from the palette.
    *   *Characteristics*: Saturation 20-90%, Lightness 25-42%.

### Active Category List
| Category | Variable Prefix | BG (200) | Text (600) |
| :--- | :--- | :--- | :--- |
| **Toys** | `--color-rose` | `0 25% 93%` | `0 32% 42%` |
| **Patchwork** | `--color-lime` | `72 23% 92%` | `71 31% 30%` |
| **Composition** | `--color-tan` | `30 13% 91%` | `32 22% 32%` |
| **Textile** | `--color-sand` | `38 13% 90%` | `43 19% 29%` |
| **Doll Clothing** | `--color-brown` | `9 17% 92%` | `9 23% 42%` |
| **Accessories** | `--color-orange` | `26 71% 91%` | `28 92% 29%` |
| **Knitting** | `--color-teal` | `180 34% 90%` | `180 53% 25%` |
| **New / In Stock** | `--color-olive` | `60 4% 91%` | `48 6% 30%` |

*To expand the list, simply select new "pastel" shades from `colors.md` following the 200/600 logic.*

## Admin Area Theme (Dashboard)

The Admin Area uses a more operational palette to ensure efficiency and a "management" feel, while staying within the core brand colors.

```css
.admin-area {
  /* Base Colors - Same as Public for consistency */
  --background: 30 11% 98%;    /* Tan 50 */
  --foreground: 34 17% 10%;    /* Tan 900 */

  /* Operational Primary: Teal 600 (Professional & Stable) */
  --primary: 180 53% 25%;      /* Teal 600 */
  --primary-foreground: 180 34% 90%; /* Teal 200 */

  /* Secondary: Olive 200 (Subtle for sidebars/headers) */
  --secondary: 60 4% 91%;      /* Olive 200 */
  --secondary-foreground: 48 6% 30%; /* Olive 600 */

  /* Muted elements */
  --muted: 60 4% 91%;          /* Olive 200 */
  --muted-foreground: 45 10% 46%; /* Ivory 500 */

  /* Distinct Accents */
  --accent: 30 13% 91%;        /* Tan 200 */
  --accent-foreground: 34 17% 10%;

  /* Status Colors */
  --success: 71 31% 30%;       /* Lime 600 - Validated / Published */
  --warning: 28 92% 29%;       /* Orange 600 - Pending / Action required */
  --destructive: 0 32% 42%;    /* Rose 600 - Deletion / Errors */
  --info: 45 10% 46%;          /* Ivory 500 - Drafts / Info / Processing */
  
  --border: 30 13% 91%;        /* Tan 200 */
  --input: 30 13% 91%;
  --ring: 180 53% 25%;         /* Teal 600 */
}
```

### Admin Design Principles
1.  **Sidebar**: Use `--secondary` for the sidebar background to separate it visually from the main content area.
2.  **Active States**: Use `--primary` for active navigation links and action buttons.
3.  **Data Tables**: Use `--background` for rows and `--muted/50` for header rows.
4.  **Buttons**: Use Shadcn's default variants, where `variant="default"` is the Teal primary.

## Status vs. Category Logic

To avoid visual confusion in the Admin Dashboard:

1.  **Status (System States)**:
    *   Use **saturated** colors (shade 600).
    *   Usually accompanied by an **icon** (Check, Alert, Trash).
    *   Applied to badges or text that describe a *state* (e.g., "Shipped", "Error").
2.  **Category (Entity Types)**:
    *   Use **pastel** backgrounds (shade 200) with dark text.
    *   Applied to badges that describe *what* the item is (e.g., "Toys", "Textile").
    *   Can be varied and numerous without breaking the system UI.

## Implementation Notes

1. **Radius**: Default `0.75rem` (12px) for cards, `100px` for search bars and category tags.
2. **Typography**: 
   - Body: `Inter` (Sans-serif)
   - Titles: `Playfair Display` (Serif)
3. **Animations**: Smooth transitions (`0.2s` - `0.6s`) for hover effects and image zooms.
4. **Shadows**: Subtle shadows for dropdowns and popovers (`0 12px 30px rgba(0, 0, 0, 0.08)`).
