# Business logic

What this app actually lets you do — on the public catalog and in the admin panel,
section by section. This is a functional description, not a technical one; for
architecture, routes, auth and env vars, see `CLAUDE.md` instead.

The project is a handmade-goods catalog ("Добрые подарки / Kind Gifts" — soft toys,
dolls, textiles, kitchen textiles) with a public storefront and a single-admin content
panel behind it. Everything the public sees — titles, descriptions, tag names, category
names, UI labels — exists in both Russian and English side by side, and a visitor can
switch between them at any time.

## Public site

### Browsing and filtering the catalog

The home page shows a grid of published items. Above the grid:

- A free-text **search box** filters the grid live as you type.
- A **category bar** lists every top-level category as a pill. A category that has
  subcategories shows a small dropdown on hover with its own children — picking the
  parent itself shows everything in that category *and* all its subcategories combined;
  picking a specific child narrows to just that one. Selecting a category updates the
  page's URL, so a filtered view can be linked or bookmarked.
- An **"in stock"** toggle shows only items currently marked as in stock (vs. "available
  on request").
- A **favorites (heart)** toggle shows only the items you've personally liked. Likes are
  remembered in your browser (not tied to an account), so they persist across visits on
  the same device/browser but aren't shared anywhere.
- The grid loads more items automatically as you scroll down (infinite scroll), rather
  than paged navigation.

Each catalog card shows the item's cover photo, title, a short description, its
category (clicking the category badge on a card jumps straight to that filter), and a
heart button to like/unlike it. If an item has more than one photo, hovering the card
reveals left/right arrows and dot indicators to flip through them right there in the
grid, without opening the item.

### An individual item's page

Opening an item shows its full photo gallery (as a masonry-style layout), its title,
description, category badge, stock status, and any tags it has, followed by a panel of
contact links (social media, messaging apps, etc. — configured once for the whole site,
not per item) for reaching out about that item. Clicking any gallery photo opens a
fullscreen viewer you can navigate with the on-screen arrows, the keyboard arrow keys,
swipe gestures, or the Escape key to close it.

### Comments

Anyone can leave a comment on an item's page by giving a name and a message — no
account needed. The site remembers your name in your browser so you don't have to
retype it next time. A new comment doesn't appear publicly right away — it's held for
moderation and only shows up once an admin approves it. If the admin replies to a
comment, that reply is shown directly under it, visibly marked as coming from the admin.

### Language

A single control switches the whole site between Russian and English; it updates the
current page's URL to the other language rather than just relabeling the UI. A
first-time visitor with no saved preference is placed into a language automatically
based on their browser's language settings.

## Admin panel

Reached by logging in with Google (restricted to pre-approved admin accounts). The
sidebar is organized around one section per content type: Projects (the dashboard),
Categories, Collections, Tags, Colors, Translations, Media Library, and Comments.

### Projects (the dashboard)

This is the main item-management screen: a searchable, infinitely-scrolling table of
every item regardless of status, each row showing its thumbnail, title, category,
status and stock state, with quick actions to view it live, edit it, or delete it (with
a confirmation step). "Add project" opens the editor described below.

**The item editor** is the richest part of the admin panel:

- **Title and description** are edited one language at a time — whichever language
  you're currently working in — but saving never erases what's already written in the
  *other* language; each language is merged in independently.
- **Collection** and **category** are required to publish an item. Picking a category
  that has its own set of "suggested" tags automatically adds those tags to the item
  (and removes the previous category's suggested tags if you switch categories) — you
  can still add or remove tags freely afterward.
- **Tags** are picked from a searchable list, and — notably — if you type a tag name
  that doesn't exist yet, you can create it on the spot right from that same list
  instead of leaving the editor to create it separately first.
- **Photos** are attached from the media library (see below) via a picker — the editor
  itself doesn't upload new files, it only attaches already-uploaded ones. Once
  attached, the photos can be:
  - **Reordered** by dragging them.
  - **Repositioned**: each photo has its own focal point and zoom level you set by
    dragging the image around inside a preview frame and adjusting a zoom slider — this
    controls how that photo is cropped/framed wherever it's shown (the catalog grid,
    the item page), without ever modifying the original uploaded file.
  - **Marked as the cover photo** (the one used as the item's thumbnail everywhere) —
    any attached photo can be promoted to cover with one click, carrying over its own
    position/zoom setting.
  - **Removed** from this item (this only detaches it from the item; the file itself
    stays in the media library for reuse elsewhere).
- **In stock** is a simple yes/no toggle; items not in stock show as "available on
  request" to visitors instead of being hidden.
- **Publication date** can be set or backdated manually via a date picker, independent
  of when the item was actually created in the system — useful for controlling display
  order.
- **Status** has three states: *Draft* (hidden from the public, can be saved with only
  partial information filled in), *Published* (visible to everyone — publishing is only
  allowed once a title, collection, category and cover photo are all set), and
  *Archived* (also hidden from the public — an end state for retiring an item, separate
  from going back to Draft).

### Categories

Categories can be nested under a parent category, each assigned to a collection, given a set of
"suggested" tags (used by the item editor as above), and given a color accent used for
its badge everywhere it's shown. The color isn't limited to a fixed palette — typing any
custom hex color automatically saves it as a new reusable color (or you can pick one
already saved from a swatch row). Categories can be reordered by dragging them, which
controls their display order in the public category bar. A category can't be deleted
while it still has subcategories or items assigned to it — those need to be reassigned
or removed first.

The public category bar itself only ever shows two levels — a top-level category and
its direct subcategories (picked from the dropdown on hover, as described above). The
admin editor doesn't technically stop you from nesting a category under a subcategory
to go deeper than that, but a category nested that deep wouldn't be reachable from the
public bar at all, so in practice categories stay two levels deep.

### Collections

A collection is a broader grouping that every category belongs to (think of it as the
layer above categories). A collection can be flagged as "main" — today this is purely a
visual label (a star badge) in the admin list and doesn't change anything about what's
shown publicly.

### Tags

A dedicated list for managing tags directly — renaming or deleting them outside the
context of any one item or category (tags can also be created inline from the item or
category editors, as described above). Deleting a tag here removes it from every item
and category it was attached to, without a separate warning about how many places that
is.

### Colors

A reusable palette of hex colors used for category accents (see above). They're mostly
managed implicitly while editing a category, but can also be managed as their own list.
A color still assigned to a category can't be deleted until it's no longer in use.

### Media Library

A central library of every uploaded photo, independent of which items use them. Files
are added by dragging them onto the drop zone or picking them from a file browser,
**many at once** — uploaded one by one with a progress indicator, and if some files in a
batch fail (wrong format, too large, etc.) the rest still go through, with the failed
filenames listed separately so nothing silently disappears. Only JPEG/PNG images are
accepted, and there's a size limit per file and a limit on how many files can be
selected in one batch. Deleting a photo is blocked while it's still in use as an item's
cover or gallery image elsewhere — it has to be detached from every item first.

### Comments (moderation)

Every comment submitted publicly starts out in a "Review" state and is invisible on the
site until an admin approves it. From this screen an admin can filter comments by
status, approve or reject any comment (reversibly — a decision can be changed later),
reply to a comment (shown to visitors as a visibly-marked admin reply under the
original), or delete a comment outright — deleting a comment that has replies removes
those replies with it.

### Translations

A cross-content view of how complete the ru/en translation is for everything in the
site: projects, categories, tags, collections, and the UI's own text labels, each shown
with a badge flagging which language (if any) is still missing a translation. Opening
any item from this view lands on a side-by-side editor with one column per active
language, so filling in a missing translation for an existing item doesn't require
reopening its full editor.

This is also where the site's own interface text (button labels, messages, etc. — not
catalog content) is managed as "system texts": each one has a short key, its text in
each language, and a visibility setting — public (visible to site visitors), admin
(visible only inside this panel), or shared (both) — letting new UI text be added or
changed without a code deployment.

### Login

A single admin (or a short allow-list of admin email addresses) signs in with their
Google account; no separate username/password exists. In local development only, a
one-click bypass button skips Google entirely for faster testing.
