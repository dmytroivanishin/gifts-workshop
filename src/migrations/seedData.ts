import { Post, Category, Collection, Color, Tag, User, PostMedia } from "@/types";

// Stable, high-quality standard UUIDs
export const USER_ID = "c0a80101-1111-4444-9999-abcdefabcdef";
export const COLLECTION_ID = "c011ec71-beef-4000-8000-000000000001";

export const COLORS = {
  cat1: "c0100001-beef-4000-8000-000000000001",
  cat2: "c0100002-beef-4000-8000-000000000002",
  cat3: "c0100003-beef-4000-8000-000000000003",
  cat4: "c0100004-beef-4000-8000-000000000004",
  cat5: "c0100005-beef-4000-8000-000000000005",
  cat6: "c0100006-beef-4000-8000-000000000006",
};

export const CATEGORIES = {
  cat1: "ca7e0001-beef-4000-8000-000000000001",
  cat2: "ca7e0002-beef-4000-8000-000000000002",
  cat3: "ca7e0003-beef-4000-8000-000000000003",
  cat4: "ca7e0004-beef-4000-8000-000000000004",
  cat5: "ca7e0005-beef-4000-8000-000000000005",
  cat6: "ca7e0006-beef-4000-8000-000000000006",
};

export const MEDIA = {
  img1: "da7a0001-beef-4000-8000-000000000001",
  img2: "da7a0002-beef-4000-8000-000000000002",
  img3: "da7a0003-beef-4000-8000-000000000003",
  img4: "da7a0004-beef-4000-8000-000000000004",
  img5: "da7a0005-beef-4000-8000-000000000005",
};

export const TAGS = {
  tag1: "fa9e0001-beef-4000-8000-000000000001",
  tag2: "fa9e0002-beef-4000-8000-000000000002",
  tag3: "fa9e0003-beef-4000-8000-000000000003",
  tag4: "fa9e0004-beef-4000-8000-000000000004",
  tag5: "fa9e0005-beef-4000-8000-000000000005",
  tag6: "fa9e0006-beef-4000-8000-000000000006",
  tag7: "fa9e0007-beef-4000-8000-000000000007",
};

export const POSTS = {
  item1: "b0550001-beef-4000-8000-000000000001",
  item2: "b0550002-beef-4000-8000-000000000002",
  item3: "b0550003-beef-4000-8000-000000000003",
  item4: "b0550004-beef-4000-8000-000000000004",
  item5: "b0550005-beef-4000-8000-000000000005",
  item6: "b0550006-beef-4000-8000-000000000006",
};

// Seed Objects
export const seedUser = {
  id: USER_ID,
  email: "admin@example.com",
  name: "Admin",
  password: "admin_hashed_password",
};

export const seedColors: Color[] = [
  { id: COLORS.cat1, color: "#8F4A4A" },
  { id: COLORS.cat2, color: "#835952" },
  { id: COLORS.cat3, color: "#1E6262" },
  { id: COLORS.cat4, color: "#5C6535" },
  { id: COLORS.cat5, color: "#59513C" },
  { id: COLORS.cat6, color: "#904504" },
];

export const seedCollection: Collection = {
  id: COLLECTION_ID,
  title: "Все коллекции",
  description: "Все работы",
  main: true,
  slug: "all",
};

export const seedCategories: Category[] = [
  {
    id: CATEGORIES.cat1,
    title: { ru: "Плюшевые истории", en: "Plush Stories" },
    description: { ru: "Мягкие игрушки ручной работы", en: "Handmade soft toys" },
    order: 1,
    color: COLORS.cat1,
    collection: COLLECTION_ID,
    slug: "plush-stories",
  },
  {
    id: CATEGORIES.cat2,
    title: { ru: "Куколки", en: "Dolls" },
    description: { ru: "Интерьерные куклы", en: "Interior art dolls" },
    order: 2,
    color: COLORS.cat2,
    collection: COLLECTION_ID,
    slug: "dolls",
  },
  {
    id: CATEGORIES.cat3,
    title: { ru: "Уют на кухне", en: "Kitchen Comfort" },
    description: { ru: "Кухонный текстиль", en: "Handmade kitchen textiles" },
    order: 3,
    color: COLORS.cat3,
    collection: COLLECTION_ID,
    slug: "kitchen-comfort",
  },
  {
    id: CATEGORIES.cat4,
    title: { ru: "Семейные традиции", en: "Family Traditions" },
    description: { ru: "Лоскутное шитье", en: "Traditional patchwork stitching" },
    order: 4,
    color: COLORS.cat4,
    collection: COLLECTION_ID,
    slug: "family-traditions",
  },
  {
    id: CATEGORIES.cat5,
    title: { ru: "Для любимого дома", en: "For Beloved Home" },
    description: { ru: "Уютные предметы интерьера", en: "Cozy home decor details" },
    order: 5,
    color: COLORS.cat5,
    collection: COLLECTION_ID,
    slug: "for-beloved-home",
  },
  {
    id: CATEGORIES.cat6,
    title: { ru: "Радость в деталях", en: "Joy in Details" },
    description: { ru: "Декоративные аксессуары и подарки", en: "Decorative accessories and small gifts" },
    order: 6,
    color: COLORS.cat6,
    collection: COLLECTION_ID,
    slug: "joy-in-details",
  },
];

export const seedTags: Tag[] = [
  { id: TAGS.tag1, name: "bunny", slug: "bunny", categories: [CATEGORIES.cat1] },
  { id: TAGS.tag2, name: "gift", slug: "gift", categories: [CATEGORIES.cat1, CATEGORIES.cat2] },
  { id: TAGS.tag3, name: "giraffe", slug: "giraffe", categories: [CATEGORIES.cat1] },
  { id: TAGS.tag4, name: "vintage", slug: "vintage", categories: [CATEGORIES.cat1, CATEGORIES.cat2] },
  { id: TAGS.tag5, name: "miniature", slug: "miniature", categories: [CATEGORIES.cat2, CATEGORIES.cat4] },
  { id: TAGS.tag6, name: "linen", slug: "linen", categories: [CATEGORIES.cat3] },
  { id: TAGS.tag7, name: "quilt", slug: "quilt", categories: [CATEGORIES.cat4] },
];

export const seedPosts: Post[] = [
  {
    id: POSTS.item1,
    title: { ru: "Зайка Мечтательница", en: "Dreamer Bunny" },
    description: { ru: "Нежная зайка ручной работы в розовом платье, ждущая чуда у окна.", en: "A delicate handmade bunny in a pink dress, waiting for a miracle by the window." },
    in_stock: true,
    status: "Published",
    collection: COLLECTION_ID,
    category: CATEGORIES.cat1,
    tags: [TAGS.tag1, TAGS.tag2],
    poster: {
      id: MEDIA.img1,
      thumbnailUrl: "/images/image-1.png",
      originalUrl: "/images/image-1.png",
      position: { x: 5, y: -15, zoom: 1.15 } // Seed crop position coordinates
    },
    media: [
      {
        id: "pm-1-1",
        order: 1,
        media: {
          id: MEDIA.img1,
          thumbnailUrl: "/images/image-1.png",
          originalUrl: "/images/image-1.png",
        },
        position: { x: 5, y: -15, zoom: 1.15 }
      },
      {
        id: "pm-1-2",
        order: 2,
        media: {
          id: MEDIA.img3,
          thumbnailUrl: "/images/image-3.png",
          originalUrl: "/images/image-3.png",
        }
      }
    ],
    slug: "dreamer-bunny",
  },
  {
    id: POSTS.item2,
    title: { ru: "Осенний Жираф", en: "Autumn Giraffe" },
    description: { ru: "Уютный жираф в желтом шарфе, вдохновленный теплыми осенними днями.", en: "A cozy giraffe in a yellow scarf, inspired by warm autumn days." },
    in_stock: true,
    status: "Published",
    collection: COLLECTION_ID,
    category: CATEGORIES.cat1,
    tags: [TAGS.tag3],
    poster: {
      id: MEDIA.img4,
      thumbnailUrl: "/images/image-4.png",
      originalUrl: "/images/image-4.png",
      position: { x: 0, y: 0, zoom: 1.0 }
    },
    media: [
      {
        id: "pm-2-1",
        order: 1,
        media: {
          id: MEDIA.img4,
          thumbnailUrl: "/images/image-4.png",
          originalUrl: "/images/image-4.png",
        },
        position: { x: 0, y: 0, zoom: 1.0 }
      }
    ],
    slug: "autumn-giraffe",
  },
  {
    id: POSTS.item3,
    title: { ru: "Зайка на Стульчике", en: "Bunny on a Chair" },
    description: { ru: "Коллекционная зайка ручной работы в изысканном винтажном наряде.", en: "A collectible handmade bunny in an exquisite vintage outfit." },
    in_stock: false,
    status: "Published",
    collection: COLLECTION_ID,
    category: CATEGORIES.cat1,
    tags: [TAGS.tag1, TAGS.tag4],
    poster: {
      id: MEDIA.img2,
      thumbnailUrl: "/images/image-2.png",
      originalUrl: "/images/image-2.png",
      position: { x: -10, y: 5, zoom: 1.1 }
    },
    media: [
      {
        id: "pm-3-1",
        order: 1,
        media: {
          id: MEDIA.img2,
          thumbnailUrl: "/images/image-2.png",
          originalUrl: "/images/image-2.png",
        },
        position: { x: -10, y: 5, zoom: 1.1 }
      }
    ],
    slug: "bunny-on-a-chair",
  },
  {
    id: POSTS.item4,
    title: { ru: "Зайка и Сказочный Дом", en: "Bunny & Fairytale House" },
    description: { ru: "Уникальная интерьерная композиция с зайкой ручной работы и её уютным деревянным домиком.", en: "A unique interior composition with a handmade bunny and her cozy wooden dollhouse." },
    in_stock: true,
    status: "Published",
    collection: COLLECTION_ID,
    category: CATEGORIES.cat2,
    tags: [TAGS.tag1, TAGS.tag5],
    poster: {
      id: MEDIA.img5,
      thumbnailUrl: "/images/image-5.png",
      originalUrl: "/images/image-5.png",
      position: { x: 0, y: 20, zoom: 1.25 }
    },
    media: [
      {
        id: "pm-4-1",
        order: 1,
        media: {
          id: MEDIA.img5,
          thumbnailUrl: "/images/image-5.png",
          originalUrl: "/images/image-5.png",
        },
        position: { x: 0, y: 20, zoom: 1.25 }
      }
    ],
    slug: "bunny-and-fairytale-house",
  },
  {
    id: POSTS.item5,
    title: { ru: "Кухонный Уютный Набор", en: "Cozy Kitchen Set" },
    description: { ru: "Набор прихваток и салфеток из натурального льна в традиционном деревенском стиле.", en: "A set of potholders and napkins made of natural linen in a traditional rustic style." },
    in_stock: true,
    status: "Published",
    collection: COLLECTION_ID,
    category: CATEGORIES.cat3,
    tags: [TAGS.tag6],
    poster: {
      id: MEDIA.img3,
      thumbnailUrl: "/images/image-3.png",
      originalUrl: "/images/image-3.png",
      position: { x: 0, y: 0, zoom: 1.0 }
    },
    media: [
      {
        id: "pm-5-1",
        order: 1,
        media: {
          id: MEDIA.img3,
          thumbnailUrl: "/images/image-3.png",
          originalUrl: "/images/image-3.png",
        },
        position: { x: 0, y: 0, zoom: 1.0 }
      }
    ],
    slug: "cozy-kitchen-set",
  },
  {
    id: POSTS.item6,
    title: { ru: "Семейное Одеяло", en: "Family Quilt" },
    description: { ru: "Большое стеганое лоскутное одеяло ручной работы. Тепло и уют для вашей семьи.", en: "A large quilted patchwork blanket. Warmth and comfort for your family." },
    in_stock: false,
    status: "Published",
    collection: COLLECTION_ID,
    category: CATEGORIES.cat4,
    tags: [TAGS.tag7],
    poster: {
      id: MEDIA.img2,
      thumbnailUrl: "/images/image-2.png",
      originalUrl: "/images/image-2.png",
      position: { x: 0, y: -10, zoom: 1.1 }
    },
    media: [
      {
        id: "pm-6-1",
        order: 1,
        media: {
          id: MEDIA.img2,
          thumbnailUrl: "/images/image-2.png",
          originalUrl: "/images/image-2.png",
        },
        position: { x: 0, y: -10, zoom: 1.1 }
      }
    ],
    slug: "family-quilt",
  },
];
