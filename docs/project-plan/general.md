# Gifts Workshop 

## Main Idea
The website is a gift workshop showcasing work in sewing, quilting, toy making, dolls, textiles, and kitchen textiles.
The primary audience includes adults and children looking to purchase toys or textiles, as well as individuals interested in learning how to sew.

The site is divided into two sections: the Public Site and the Admin Panel.

## Business Objectives & Branding
- **Brand Identity**: The website must convey a "handmade/kind gifts" (Добрые подарки) aesthetic—warm, professional, and trustworthy. This is achieved through premium typography, a soft color palette, and high-quality visuals.
- **Audience Reach**: Support for multi-language (Localization) is required to cater to both local and international customers (e.g., Russian and English).
- **Conversion**: The primary goal is to showcase craftsmanship and facilitate sales or inquiries for toys and textiles.


## Public Site
Includes everything visible to the user, excluding the admin panel.
The main page features project cards that can be searched and filtered by category.
Each project has a dedicated page with a detailed description and photographs.

### Required Features
- **Main Page**:
  - Header:
    - Logo
    - Search field
  - Category Filter (multi-select capability)
  - Content displayed as cards with infinite scroll pagination.
- **Project Detail Page**:
  - Features: Project photos in a masonry grid (Pinterest-style), description, category, and tags. Clicking a category or tag redirects to the main page with the corresponding filters applied.
- **Card**:
  - Each card on the main page includes: Project title, photo, description with "..." (descriptions longer than 100 characters are truncated), and categories displayed as colored badges (clicking them filters the projects). Badge colors are configured in the Admin Panel. Users can "Like" a project to save it to favorites locally on their device.
  - Image Gallery: Cards include a gallery that can be navigated with left/right arrows, with dots at the bottom indicating the total number of images and the current position.
  - **Layout**: Image at the top; category badge on the left and Like button on the right at the same level; title below; description below the title; and a "View Project" button with a right arrow leading to the project page.
  - Consistency: All cards have a uniform shape, square images, fixed text length, and aligned buttons.
- **Availability Labels**: (Based on `in_stock` status) Projects should clearly indicate if they are "In Stock" (ready for purchase) or "Made to Order/Sold". This helps manage customer expectations.
- **Engagement**: The "Like" functionality (stored locally) encourages repeat visits and builds a "wishlist" for the user.
- **Call to Action**: Every project detail page should have a clear way for the user to inquire about the item (e.g., links to Telegram, WhatsApp, or Email).

## SEO & Marketing
- **Friendly URLs**: Every project, album, and category must have a human-readable slug (e.g., `/projects/dreamy-bunny`) for better search engine indexing.
- **Social Sharing**: The site should be optimized for sharing on social media (Instagram, Pinterest) with proper OpenGraph metadata (titles and preview images).


## Admin Panel
Includes everything visible to the author.
- **Authorization**
- **Main Page**: Editor for the project cards displayed on the public site.
- **Category Management**: Define categories and assign colors from predefined options.
- **Tag Management**
- **Media Management**: A library for all uploaded images.
- **Profile Editing**
- **Post Archive**: Stores deleted or archived posts, with the option to restore them.

**Posts**
When creating a post, the following information is requested:
- Project Title
- Project Description
- **Category**: Select from existing categories or create a new one on the fly (automatically added to the system).
- **Tags**: Select from existing tags or create new ones implicitly during selection. Tags are displayed as standard colored badges in a combobox component (using shadcn/ui).
- **Images**: Select from the media library or upload new ones.
- **Cover Image**: Selected from the media library or uploaded; defaults to the first project image if not specified.
- **Drafts**: Posts can be saved as drafts without filling all mandatory fields.
- **Publishing**: All fields must be completed before a post can be published.
- **Editing**: Ability to edit, delete, or archive published posts.
- **Image Processing**: Users must select a square area for thumbnails and original images.
- **Ordering**: Ability to change the order of images within a post.
- **Manual Sorting**: Ability to override the creation date to manually prioritize or reorder posts in the list.

**Media Files**
- Images can be uploaded individually or in bulk.
- Automatic conversion to JPG format.
- Two sizes are generated:
  - **Thumbnail** (300x300) - fitted to dimensions.
  - **Original** (1200x1200) - fitted to dimensions.
- **Integrity Check**: Images cannot be deleted if they are currently used in a post or as a cover.

**Categories**
- CRUD operations for categories (Name, Color, Description).
- Search and filter capabilities.
- New categories are assigned a random color by default, which can be edited later.

**Tags**
- CRUD operations for tags (Name, Description).
- Search and filter capabilities.
- Tags are associated with categories, and the list of associated tags is stored within each category.
