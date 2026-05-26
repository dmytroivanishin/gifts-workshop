function transliterate(text: string): string {
  const ru: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ь': '', 'ы': 'y', 'ъ': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ь': '', 'Ы': 'Y', 'Ъ': '', 'Э': 'E', 'Ю': 'Yu',
    'Я': 'Ya'
  };
  return text.split('').map(char => ru[char] !== undefined ? ru[char] : char).join('');
}

export async function translateToEnglish(text: string): Promise<string> {
  if (!text) return "";
  
  // If text is already strictly English/alphanumeric with basic symbols, return it
  if (/^[a-zA-Z0-9\s\-_.,?!'"]+$/.test(text)) {
    return text.trim();
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Translation service returned error response");
    const json = await response.json();
    
    // Google Translate single sentence format: [[["translatedText", "originalText", ...]]]
    if (json && json[0] && json[0][0] && json[0][0][0]) {
      return json[0][0][0];
    }
  } catch (error) {
    console.error("Smart translation failed, using transliteration fallback:", error);
  }

  // Fallback to simple transliteration
  return transliterate(text);
}

export async function generateSlug(text: string): Promise<string> {
  const englishText = await translateToEnglish(text);
  
  return englishText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, "")    // Remove any special characters except spaces and hyphens
    .trim()
    .replace(/\s+/g, "-")            // Replace multiple spaces with a single hyphen
    .replace(/-+/g, "-");            // Replace multiple hyphens with a single hyphen
}

export async function generateSlugFromField(field: string | { ru?: string; en?: string } | undefined): Promise<string> {
  if (!field) return `slug-${Date.now()}`;
  
  if (typeof field === "string") {
    return generateSlug(field);
  }
  
  if (typeof field === "object") {
    // Prefer English value if provided, otherwise translate Russian
    if (field.en && field.en.trim().length > 0) {
      return generateSlug(field.en);
    }
    if (field.ru && field.ru.trim().length > 0) {
      return generateSlug(field.ru);
    }
  }
  
  return `slug-${Date.now()}`;
}

export async function generateUniqueSlug(
  field: string | { ru?: string; en?: string } | undefined,
  currentId: string,
  getBySlug: (slug: string) => Promise<{ id: string } | null | undefined>
): Promise<string> {
  const baseSlug = await generateSlugFromField(field);
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const existing = await getBySlug(slug);
    if (!existing || existing.id === currentId) {
      break;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
  return slug;
}
