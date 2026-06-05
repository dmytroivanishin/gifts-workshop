import { drizzleDatabase } from "../repositories/drizzle/database";
import { systemTexts } from "../repositories/drizzle/schema";

const adminKeys = [
  "categories", "categories_subtitle", "loading_categories", "title", "description", "collections", 
  "placeholder_select_collection", "parent_category", "none_main_category", "tags", "placeholder_select_tags", 
  "placeholder_search_tags", "add_new_tag_prompt", "color_accent", "subcategory_of", "delete", "no_categories", 
  "add_category", "placeholder_category_title", "placeholder_category_desc", "delete_confirm_category", 
  "manage_collections", "loading_collections", "main", "no_description", "edit_collection", "delete_collection", 
  "no_projects", "add_collection", "cancel_action", "placeholder_collection_title", "placeholder_collection_desc", 
  "main_collection", "saving", "save", "delete_confirm_collection", "colors", "colors_subtitle", "add_color", 
  "colors_manager", "delete_confirm_color", "comments_subtitle", "all_statuses", "loading", "no_comments", 
  "projects_manager", "admin_panel", "add_project", "search_projects", "loading_projects", "category", "status", 
  "availability", "actions", "view", "edit", "loading_more_projects", "projects", "delete_confirm", "tags_manager", 
  "translations", "media_library", "translations_success", "translations_error", "items_not_found", 
  "translations_title", "VALIDATION_ERROR", "translations_subtitle", "manage_languages", "entity_type", 
  "system_texts", "translated_fully", "missing_translation", "loading_list", "load_more", "all_items_loaded", 
  "media_subtitle", "drag_drop_files", "media_limits", "uploading", "select_files", "loading_media", "no_media", 
  "delete_confirm_media", "edit_project", "create_project", "edit_project_subtitle", "create_project_subtitle", 
  "placeholder_project_title", "collection", "placeholder_search_collections", "placeholder_select_category", 
  "placeholder_search_categories", "placeholder_project_desc", "placeholder_search_or_type_tag", "creation_date", 
  "gallery_and_media", "add_media", "no_media_selected", "archive", "save_draft", "update", "publish", 
  "tags_subtitle", "all_tags", "loading_tags", "tag_name_placeholder", "rename_tag", "delete_tag", "no_tags", 
  "loading_more_tags", "add_new_tag", "tag_name", "placeholder_vintage", "create_tag", "delete_confirm_tag"
];

const publicKeys = [
  "search_placeholder", "favorites", "all", "no_projects_found", "back_to_gallery", "contact_title"
];

const sharedKeys = [
  "in_stock", "on_request", "error_500_title", "error_500_desc", "error_500_retry", "error_500_back", 
  "error_404_title", "error_404_desc", "error_404_back", "view_project", "comments", "leave_comment", 
  "your_name", "commenting_as", "change", "write_comment", "comment_submitted", "post_comment", "admin", 
  "no_comments_yet", "position_cover_image", "drag_to_position", "zoom", "cancel", "apply_crop", "select_media", 
  "select_media_description", "no_media_found", "items_selected", "confirm_selection", "remove", "drag_to_reorder", 
  "cover", "set_cover", "position"
];

const allKnownKeys = new Set([...adminKeys, ...publicKeys, ...sharedKeys]);

async function verify() {
  console.log("Verifying keys against DB...");
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    console.error("❌ DB_URI is not set in environment.");
    process.exit(1);
  }
  
  await drizzleDatabase.connect(dbUri);
  const db = drizzleDatabase.getDb();

  try {
    const allDbTexts = await db.select({ id: systemTexts.id }).from(systemTexts);
    const dbKeys = new Set(allDbTexts.map(t => t.id));

    const missedKeys = Array.from(dbKeys).filter(k => !allKnownKeys.has(k));
    const extraKeys = Array.from(allKnownKeys).filter(k => !dbKeys.has(k));

    if (missedKeys.length > 0) {
      console.log("❌ The script missed the following keys present in DB (they will be marked 'admin' by default if run):");
      console.log(missedKeys.join(", "));
    } else {
      console.log("✅ All keys in DB are accounted for in our script!");
    }

    if (extraKeys.length > 0) {
      console.log("⚠️ The script found these keys in code, but they are NOT in the DB:");
      console.log(extraKeys.join(", "));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

verify();
