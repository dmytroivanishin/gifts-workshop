const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/db.json");

// UUID Definitions
const USER_ID = "c0a80101-1111-4444-9999-abcdefabcdef";
const COLLECTION_ID = "c011ec71-beef-4000-8000-000000000001";

const COLORS = {
  cat1: "c0100001-beef-4000-8000-000000000001",
  cat2: "c0100002-beef-4000-8000-000000000002",
  cat3: "c0100003-beef-4000-8000-000000000003",
  cat4: "c0100004-beef-4000-8000-000000000004",
  cat5: "c0100005-beef-4000-8000-000000000005",
  cat6: "c0100006-beef-4000-8000-000000000006",
};

const CATEGORIES = {
  cat1: "ca7e0001-beef-4000-8000-000000000001",
  cat2: "ca7e0002-beef-4000-8000-000000000002",
  cat3: "ca7e0003-beef-4000-8000-000000000003",
  cat4: "ca7e0004-beef-4000-8000-000000000004",
  cat5: "ca7e0005-beef-4000-8000-000000000005",
  cat6: "ca7e0006-beef-4000-8000-000000000006",
};

const MEDIA = {
  img1: "da7a0001-beef-4000-8000-000000000001",
  img2: "da7a0002-beef-4000-8000-000000000002",
  img3: "da7a0003-beef-4000-8000-000000000003",
  img4: "da7a0004-beef-4000-8000-000000000004",
  img5: "da7a0005-beef-4000-8000-000000000005",
};

const TAGS = {
  tag1: "fa9e0001-beef-4000-8000-000000000001",
  tag2: "fa9e0002-beef-4000-8000-000000000002",
  tag3: "fa9e0003-beef-4000-8000-000000000003",
  tag4: "fa9e0004-beef-4000-8000-000000000004",
  tag5: "fa9e0005-beef-4000-8000-000000000005",
  tag6: "fa9e0006-beef-4000-8000-000000000006",
  tag7: "fa9e0007-beef-4000-8000-000000000007",
};

const POSTS = {
  item1: "b0550001-beef-4000-8000-000000000001",
  item2: "b0550002-beef-4000-8000-000000000002",
  item3: "b0550003-beef-4000-8000-000000000003",
  item4: "b0550004-beef-4000-8000-000000000004",
  item5: "b0550005-beef-4000-8000-000000000005",
  item6: "b0550006-beef-4000-8000-000000000006",
};

const dbData = {
  posts: [
    {
      id: POSTS.item1,
      in_stock: true,
      status: "Published",
      collection: COLLECTION_ID,
      category: CATEGORIES.cat1,
      tags: [TAGS.tag1, TAGS.tag2],
      media: [
        {
          id: "pm-1-1",
          order: 1,
          media: MEDIA.img1,
          position: { x: 5, y: -15, zoom: 1.15 } // Local crop positioning
        },
        {
          id: "pm-1-2",
          order: 2,
          media: MEDIA.img3,
          position: null
        }
      ],
      poster: MEDIA.img1,
      slug: "dreamer-bunny"
    },
    {
      id: POSTS.item2,
      in_stock: true,
      status: "Published",
      collection: COLLECTION_ID,
      category: CATEGORIES.cat1,
      tags: [TAGS.tag3],
      media: [
        {
          id: "pm-2-1",
          order: 1,
          media: MEDIA.img4,
          position: { x: 0, y: 0, zoom: 1.0 }
        }
      ],
      poster: MEDIA.img4,
      slug: "autumn-giraffe"
    },
    {
      id: POSTS.item3,
      in_stock: false,
      status: "Published",
      collection: COLLECTION_ID,
      category: CATEGORIES.cat1,
      tags: [TAGS.tag1, TAGS.tag4],
      media: [
        {
          id: "pm-3-1",
          order: 1,
          media: MEDIA.img2,
          position: { x: -10, y: 5, zoom: 1.1 }
        }
      ],
      poster: MEDIA.img2,
      slug: "bunny-on-a-chair"
    },
    {
      id: POSTS.item4,
      in_stock: true,
      status: "Published",
      collection: COLLECTION_ID,
      category: CATEGORIES.cat2,
      tags: [TAGS.tag1, TAGS.tag5],
      media: [
        {
          id: "pm-4-1",
          order: 1,
          media: MEDIA.img5,
          position: { x: 0, y: 20, zoom: 1.25 }
        }
      ],
      poster: MEDIA.img5,
      slug: "bunny-and-fairytale-house"
    },
    {
      id: POSTS.item5,
      in_stock: true,
      status: "Published",
      collection: COLLECTION_ID,
      category: CATEGORIES.cat3,
      tags: [TAGS.tag6],
      media: [
        {
          id: "pm-5-1",
          order: 1,
          media: MEDIA.img3,
          position: { x: 0, y: 0, zoom: 1.0 }
        }
      ],
      poster: MEDIA.img3,
      slug: "cozy-kitchen-set"
    },
    {
      id: POSTS.item6,
      in_stock: false,
      status: "Published",
      collection: COLLECTION_ID,
      category: CATEGORIES.cat4,
      tags: [TAGS.tag7],
      media: [
        {
          id: "pm-6-1",
          order: 1,
          media: MEDIA.img2,
          position: { x: 0, y: -10, zoom: 1.1 }
        }
      ],
      poster: MEDIA.img2,
      slug: "family-quilt"
    }
  ],
  categories: [
    {
      id: CATEGORIES.cat1,
      order: 1,
      color: COLORS.cat1,
      collection: COLLECTION_ID,
      slug: "plush-stories"
    },
    {
      id: CATEGORIES.cat2,
      order: 2,
      color: COLORS.cat2,
      collection: COLLECTION_ID,
      slug: "dolls"
    },
    {
      id: CATEGORIES.cat3,
      order: 3,
      color: COLORS.cat3,
      collection: COLLECTION_ID,
      slug: "kitchen-comfort"
    },
    {
      id: CATEGORIES.cat4,
      order: 4,
      color: COLORS.cat4,
      collection: COLLECTION_ID,
      slug: "family-traditions"
    },
    {
      id: CATEGORIES.cat5,
      order: 5,
      color: COLORS.cat5,
      collection: COLLECTION_ID,
      slug: "for-beloved-home"
    },
    {
      id: CATEGORIES.cat6,
      order: 6,
      color: COLORS.cat6,
      collection: COLLECTION_ID,
      slug: "joy-in-details"
    }
  ],
  collections: [
    {
      id: COLLECTION_ID,
      main: true,
      slug: "all"
    }
  ],
  colors: [
    { id: COLORS.cat1, color: "#8F4A4A" },
    { id: COLORS.cat2, color: "#835952" },
    { id: COLORS.cat3, color: "#1E6262" },
    { id: COLORS.cat4, color: "#5C6535" },
    { id: COLORS.cat5, color: "#59513C" },
    { id: COLORS.cat6, color: "#904504" }
  ],
  tags: [
    { id: TAGS.tag1, name: "bunny", slug: "bunny", categories: [CATEGORIES.cat1] },
    { id: TAGS.tag2, name: "gift", slug: "gift", categories: [CATEGORIES.cat1, CATEGORIES.cat2] },
    { id: TAGS.tag3, name: "giraffe", slug: "giraffe", categories: [CATEGORIES.cat1] },
    { id: TAGS.tag4, name: "vintage", slug: "vintage", categories: [CATEGORIES.cat1, CATEGORIES.cat2] },
    { id: TAGS.tag5, name: "miniature", slug: "miniature", categories: [CATEGORIES.cat2, CATEGORIES.cat4] },
    { id: TAGS.tag6, name: "linen", slug: "linen", categories: [CATEGORIES.cat3] },
    { id: TAGS.tag7, name: "quilt", slug: "quilt", categories: [CATEGORIES.cat4] }
  ],
  slugs: [
    { id: `slug-${COLLECTION_ID}`, name: "all", entityId: COLLECTION_ID, entityType: "collection", userId: USER_ID },
    { id: `slug-${CATEGORIES.cat1}`, name: "plush-stories", entityId: CATEGORIES.cat1, entityType: "category", userId: USER_ID },
    { id: `slug-${CATEGORIES.cat2}`, name: "dolls", entityId: CATEGORIES.cat2, entityType: "category", userId: USER_ID },
    { id: `slug-${CATEGORIES.cat3}`, name: "kitchen-comfort", entityId: CATEGORIES.cat3, entityType: "category", userId: USER_ID },
    { id: `slug-${CATEGORIES.cat4}`, name: "family-traditions", entityId: CATEGORIES.cat4, entityType: "category", userId: USER_ID },
    { id: `slug-${CATEGORIES.cat5}`, name: "for-beloved-home", entityId: CATEGORIES.cat5, entityType: "category", userId: USER_ID },
    { id: `slug-${CATEGORIES.cat6}`, name: "joy-in-details", entityId: CATEGORIES.cat6, entityType: "category", userId: USER_ID },
    { id: `slug-${POSTS.item1}`, name: "dreamer-bunny", entityId: POSTS.item1, entityType: "post", userId: USER_ID },
    { id: `slug-${POSTS.item2}`, name: "autumn-giraffe", entityId: POSTS.item2, entityType: "post", userId: USER_ID },
    { id: `slug-${POSTS.item3}`, name: "bunny-on-a-chair", entityId: POSTS.item3, entityType: "post", userId: USER_ID },
    { id: `slug-${POSTS.item4}`, name: "bunny-and-fairytale-house", entityId: POSTS.item4, entityType: "post", userId: USER_ID },
    { id: `slug-${POSTS.item5}`, name: "cozy-kitchen-set", entityId: POSTS.item5, entityType: "post", userId: USER_ID },
    { id: `slug-${POSTS.item6}`, name: "family-quilt", entityId: POSTS.item6, entityType: "post", userId: USER_ID },
    { id: `slug-${TAGS.tag1}`, name: "bunny", entityId: TAGS.tag1, entityType: "tag", userId: USER_ID },
    { id: `slug-${TAGS.tag2}`, name: "gift", entityId: TAGS.tag2, entityType: "tag", userId: USER_ID },
    { id: `slug-${TAGS.tag3}`, name: "giraffe", entityId: TAGS.tag3, entityType: "tag", userId: USER_ID },
    { id: `slug-${TAGS.tag4}`, name: "vintage", entityId: TAGS.tag4, entityType: "tag", userId: USER_ID },
    { id: `slug-${TAGS.tag5}`, name: "miniature", entityId: TAGS.tag5, entityType: "tag", userId: USER_ID },
    { id: `slug-${TAGS.tag6}`, name: "linen", entityId: TAGS.tag6, entityType: "tag", userId: USER_ID },
    { id: `slug-${TAGS.tag7}`, name: "quilt", entityId: TAGS.tag7, entityType: "tag", userId: USER_ID }
  ],
  media: [
    { id: MEDIA.img1, thumbnailUrl: "/images/image-1.png", originalUrl: "/images/image-1.png", userId: USER_ID, position: { x: 5, y: -15, zoom: 1.15 } },
    { id: MEDIA.img2, thumbnailUrl: "/images/image-2.png", originalUrl: "/images/image-2.png", userId: USER_ID, position: { x: -10, y: 5, zoom: 1.1 } },
    { id: MEDIA.img3, thumbnailUrl: "/images/image-3.png", originalUrl: "/images/image-3.png", userId: USER_ID },
    { id: MEDIA.img4, thumbnailUrl: "/images/image-4.png", originalUrl: "/images/image-4.png", userId: USER_ID, position: { x: 0, y: 0, zoom: 1.0 } },
    { id: MEDIA.img5, thumbnailUrl: "/images/image-5.png", originalUrl: "/images/image-5.png", userId: USER_ID, position: { x: 0, y: 20, zoom: 1.25 } }
  ],
  users: [
    { id: USER_ID, email: "admin@example.com", name: "Admin", password: "admin_hashed_password" }
  ],
  localizations: [
    { id: `loc-${COLLECTION_ID}-ru`, locale: "ru", payload: JSON.stringify({ title: "Все коллекции", description: "Все работы" }), entityId: COLLECTION_ID, entityType: "collection", userId: USER_ID },
    { id: `loc-${COLLECTION_ID}-en`, locale: "en", payload: JSON.stringify({ title: "All Collections", description: "All works" }), entityId: COLLECTION_ID, entityType: "collection", userId: USER_ID },
    
    { id: `loc-${CATEGORIES.cat1}-ru`, locale: "ru", payload: JSON.stringify({ title: "Плюшевые истории", description: "Мягкие игрушки ручной работы" }), entityId: CATEGORIES.cat1, entityType: "category", userId: USER_ID },
    { id: `loc-${CATEGORIES.cat1}-en`, locale: "en", payload: JSON.stringify({ title: "Plush Stories", description: "Handmade soft toys" }), entityId: CATEGORIES.cat1, entityType: "category", userId: USER_ID },
    
    { id: `loc-${CATEGORIES.cat2}-ru`, locale: "ru", payload: JSON.stringify({ title: "Куколки", description: "Интерьерные куклы" }), entityId: CATEGORIES.cat2, entityType: "category", userId: USER_ID },
    { id: `loc-${CATEGORIES.cat2}-en`, locale: "en", payload: JSON.stringify({ title: "Dolls", description: "Interior art dolls" }), entityId: CATEGORIES.cat2, entityType: "category", userId: USER_ID },
    
    { id: `loc-${CATEGORIES.cat3}-ru`, locale: "ru", payload: JSON.stringify({ title: "Уют на кухне", description: "Кухонный текстиль" }), entityId: CATEGORIES.cat3, entityType: "category", userId: USER_ID },
    { id: `loc-${CATEGORIES.cat3}-en`, locale: "en", payload: JSON.stringify({ title: "Kitchen Comfort", description: "Handmade kitchen textiles" }), entityId: CATEGORIES.cat3, entityType: "category", userId: USER_ID },
    
    { id: `loc-${CATEGORIES.cat4}-ru`, locale: "ru", payload: JSON.stringify({ title: "Семейные традиции", description: "Лоскутное шитье" }), entityId: CATEGORIES.cat4, entityType: "category", userId: USER_ID },
    { id: `loc-${CATEGORIES.cat4}-en`, locale: "en", payload: JSON.stringify({ title: "Family Traditions", description: "Traditional patchwork stitching" }), entityId: CATEGORIES.cat4, entityType: "category", userId: USER_ID },
    
    { id: `loc-${CATEGORIES.cat5}-ru`, locale: "ru", payload: JSON.stringify({ title: "Для любимого дома", description: "Уютные предметы интерьера" }), entityId: CATEGORIES.cat5, entityType: "category", userId: USER_ID },
    { id: `loc-${CATEGORIES.cat5}-en`, locale: "en", payload: JSON.stringify({ title: "For Beloved Home", description: "Cozy home decor details" }), entityId: CATEGORIES.cat5, entityType: "category", userId: USER_ID },
    
    { id: `loc-${CATEGORIES.cat6}-ru`, locale: "ru", payload: JSON.stringify({ title: "Радость в деталях", description: "Декоративные аксессуары и подарки" }), entityId: CATEGORIES.cat6, entityType: "category", userId: USER_ID },
    { id: `loc-${CATEGORIES.cat6}-en`, locale: "en", payload: JSON.stringify({ title: "Joy in Details", description: "Decorative accessories and small gifts" }), entityId: CATEGORIES.cat6, entityType: "category", userId: USER_ID },

    { id: `loc-${POSTS.item1}-ru`, locale: "ru", payload: JSON.stringify({ title: "Зайка Мечтательница", description: "Нежная зайка ручной работы в розовом платье, ждущая чуда у окна." }), entityId: POSTS.item1, entityType: "post", userId: USER_ID },
    { id: `loc-${POSTS.item1}-en`, locale: "en", payload: JSON.stringify({ title: "Dreamer Bunny", description: "A delicate handmade bunny in a pink dress, waiting for a miracle by the window." }), entityId: POSTS.item1, entityType: "post", userId: USER_ID },
    
    { id: `loc-${POSTS.item2}-ru`, locale: "ru", payload: JSON.stringify({ title: "Осенний Жираф", description: "Уютный жираф в желтом шарфе, вдохновленный теплыми осенними днями." }), entityId: POSTS.item2, entityType: "post", userId: USER_ID },
    { id: `loc-${POSTS.item2}-en`, locale: "en", payload: JSON.stringify({ title: "Autumn Giraffe", description: "A cozy giraffe in a yellow scarf, inspired by warm autumn days." }), entityId: POSTS.item2, entityType: "post", userId: USER_ID },
    
    { id: `loc-${POSTS.item3}-ru`, locale: "ru", payload: JSON.stringify({ title: "Зайка на Стульчике", description: "Коллекционная зайка ручной работы в изысканном винтажном наряде." }), entityId: POSTS.item3, entityType: "post", userId: USER_ID },
    { id: `loc-${POSTS.item3}-en`, locale: "en", payload: JSON.stringify({ title: "Bunny on a Chair", description: "A collectible handmade bunny in an exquisite vintage outfit." }), entityId: POSTS.item3, entityType: "post", userId: USER_ID },
    
    { id: `loc-${POSTS.item4}-ru`, locale: "ru", payload: JSON.stringify({ title: "Зайка и Сказочный Дом", description: "Уникальная интерьерная композиция с зайкой ручной работы и её уютным деревянным домиком." }), entityId: POSTS.item4, entityType: "post", userId: USER_ID },
    { id: `loc-${POSTS.item4}-en`, locale: "en", payload: JSON.stringify({ title: "Bunny & Fairytale House", description: "A unique interior composition with a handmade bunny and her cozy wooden dollhouse." }), entityId: POSTS.item4, entityType: "post", userId: USER_ID },
    
    { id: `loc-${POSTS.item5}-ru`, locale: "ru", payload: JSON.stringify({ title: "Кухонный Уютный Набор", description: "Набор прихваток и салфеток из натурального льна в традиционном деревенском стиле." }), entityId: POSTS.item5, entityType: "post", userId: USER_ID },
    { id: `loc-${POSTS.item5}-en`, locale: "en", payload: JSON.stringify({ title: "Cozy Kitchen Set", description: "A set of potholders and napkins made of natural linen in a traditional rustic style." }), entityId: POSTS.item5, entityType: "post", userId: USER_ID },
    
    { id: `loc-${POSTS.item6}-ru`, locale: "ru", payload: JSON.stringify({ title: "Семейное Одеяло", description: "Большое стеганое лоскутное одеяло ручной работы. Тепло и уют для вашей семьи." }), entityId: POSTS.item6, entityType: "post", userId: USER_ID },
    { id: `loc-${POSTS.item6}-en`, locale: "en", payload: JSON.stringify({ title: "Family Quilt", description: "A large quilted patchwork blanket. Warmth and comfort for your family." }), entityId: POSTS.item6, entityType: "post", userId: USER_ID }
  ]
};

console.log("🚀 Starting fast direct fs database migration...");
try {
  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), "utf8");
  console.log("✨ Migration completed successfully! Database fully seeded with UUIDs and crop coordinates.");
} catch (error) {
  console.error("❌ Migration failed:", error);
  process.exit(1);
}
