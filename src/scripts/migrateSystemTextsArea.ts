import fs from "fs";
import path from "path";
import { inArray } from "drizzle-orm";
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
  "loading_more_tags", "add_new_tag", "tag_name", "placeholder_vintage", "create_tag", "delete_confirm_tag",
  "dashboard", "edit_color", "color_saved", "color_deleted", "collection_title", "collection_description", "collection_slug", "slug", "aspect_ratio", "orientation", "none", "color", "recommended_tags", "order", "edit_category", "key", "translation_ru", "translation_en", "loading_translations", "no_translations", "placeholder_collection_slug", "in_stock_label", "published", "draft", "archived", "fine_tune_cover", "select_item", "status_label", "checking_translation", "missing_en_translation", "russian_translation", "placeholder_title_ru", "placeholder_desc_ru", "english_translation", "post_created", "post_updated", "post_deleted", "category_created", "category_updated", "category_deleted", "tag_created", "tag_updated", "tag_deleted", "collection_created", "collection_updated", "collection_deleted", "remove", "drag_to_reorder"
];

const publicKeys = [
  "search_placeholder", "favorites", "all", "no_projects_found", "back_to_gallery", "contact_title", "send_message", "made_to_order"
];

const sharedKeys = [
  "in_stock", "on_request", "error_500_title", "error_500_desc", "error_500_retry", "error_500_back", 
  "error_404_title", "error_404_desc", "error_404_back", "view_project", "comments", "leave_comment", 
  "your_name", "commenting_as", "change", "write_comment", "comment_submitted", "post_comment", "admin", 
  "no_comments_yet", "position_cover_image", "drag_to_position", "zoom", "cancel", "apply_crop", "select_media", 
  "select_media_description", "no_media_found", "items_selected", "confirm_selection", "cover", "set_cover", "position",
  "error_required_field", "error_invalid_url", "error_invalid_hex", "error_collection_required", "error_category_required", "error_invalid_slug", "error_media_required", "error_invalid_email", "error_invalid_password", "error_invalid_format", "error_missing_title", "error_missing_poster", "error_missing_collection", "error_missing_category", "error_invalid_uuid", "error_name_too_long", "error_text_too_long", "UNAUTHORIZED", "UNKNOWN_ERROR"
];

async function run() {
  console.log("🚀 Starting System Texts Area Migration...");
  
  // Connect to DB
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    console.error("❌ DB_URI is not set in environment.");
    process.exit(1);
  }
  
  await drizzleDatabase.connect(dbUri);
  const db = drizzleDatabase.getDb();
  
  try {
    console.log("Updating admin texts...");
    const adminRes = await db.update(systemTexts)
      .set({ area: "admin" })
      .where(inArray(systemTexts.id, adminKeys));
    console.log(`✅ Admin keys updated`);

    console.log("Updating public texts...");
    const publicRes = await db.update(systemTexts)
      .set({ area: "public" })
      .where(inArray(systemTexts.id, publicKeys));
    console.log(`✅ Public keys updated`);

    console.log("Updating shared texts...");
    const sharedRes = await db.update(systemTexts)
      .set({ area: "shared" })
      .where(inArray(systemTexts.id, sharedKeys));
    console.log(`✅ Shared keys updated`);

    // As a fallback, set any unclassified keys to 'admin' to be safe 
    // (don't leak unknown strings to public)
    const allKnown = [...adminKeys, ...publicKeys, ...sharedKeys];
    // Wait, Drizzle doesn't have `notInArray` easily accessible without `not(inArray())`
    // Let's just fetch all and filter manually if we want to do a fallback
    const allTexts = await db.select({ id: systemTexts.id }).from(systemTexts);
    const dbKeysSet = new Set(allTexts.map(t => t.id));
    
    // 1. Set fallback area for unknown keys in DB
    const unknownKeys = allTexts.filter(t => !allKnown.includes(t.id)).map(t => t.id);
    if (unknownKeys.length > 0) {
      console.log(`Found ${unknownKeys.length} unknown keys in DB. Setting to 'admin' for safety...`);
      await db.update(systemTexts)
        .set({ area: "admin" })
        .where(inArray(systemTexts.id, unknownKeys));
    }
    // 2. Insert missing keys that exist in code but NOT in DB
    const missingFromDb = allKnown.filter(k => !dbKeysSet.has(k));
    if (missingFromDb.length > 0) {
      console.log(`Found ${missingFromDb.length} keys in code that are missing from DB. Inserting...`);
      
      const ruData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/i18n/ru.json"), "utf8"));
      const enData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/i18n/en.json"), "utf8"));

      const valuesToInsert = missingFromDb.map(key => {
        let area = "admin";
        if (publicKeys.includes(key)) area = "public";
        if (sharedKeys.includes(key)) area = "shared";
        
        // Simple humanization for default text if not found in JSON
        const defaultText = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return {
          id: key,
          content: { 
            ru: ruData[key] || defaultText, 
            en: enData[key] || defaultText 
          },
          area
        };
      });
      
      await db.insert(systemTexts).values(valuesToInsert).onConflictDoNothing();
      console.log(`✅ Inserted ${missingFromDb.length} missing keys with real translations!`);
    }

    console.log("🎉 Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

run();
