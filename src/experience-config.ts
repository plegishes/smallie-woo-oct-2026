import { categories as defaultCategories } from './data';
import type { Category, CategoryKey, GiftOption } from './types';

export const EXPERIENCE_CONFIG_STORAGE_KEY = 'birthday-experience-config-v2';
export const DEFAULT_INTRO_VIDEO_PATH = '/video/birthday-intro.mov';
export const DEFAULT_INTRO_POSTER_PATH = '/images/birthday-bg.jpg';
export const DEFAULT_CATEGORY_IMAGE_PATHS: Record<CategoryKey, string> = {
  likeDontNeed: '/images/categories/lbdn.jpg',
  dontLikeNeed: '/images/categories/dlbn.jpg',
  dontLikeDontNeed: '/images/categories/dldn.jpg',
  likeNeed: '/images/categories/ln.jpg',
};
export const DEFAULT_CATEGORY_IMAGE_POSITIONS: Record<CategoryKey, string> = {
  likeDontNeed: 'center 26%',
  dontLikeNeed: 'center 58%',
  dontLikeDontNeed: 'center 96%',
  likeNeed: 'center 70%',
};

export interface ExperienceCategoryConfig extends Category {
  imagePath: string;
  imagePosition: string;
}

export interface ExperienceConfig {
  introVideoPath: string;
  introPosterPath: string;
  categories: ExperienceCategoryConfig[];
}

function cloneGift(gift: GiftOption): GiftOption {
  return {
    name: gift.name,
    price: gift.price,
  };
}

function cloneCategory(category: ExperienceCategoryConfig): ExperienceCategoryConfig {
  return {
    ...category,
    gifts: category.gifts.map(cloneGift),
  };
}

export function createDefaultExperienceConfig(): ExperienceConfig {
  return {
    introVideoPath: DEFAULT_INTRO_VIDEO_PATH,
    introPosterPath: DEFAULT_INTRO_POSTER_PATH,
    categories: defaultCategories.map((category) => ({
      ...category,
      imagePath: DEFAULT_CATEGORY_IMAGE_PATHS[category.key],
      imagePosition: DEFAULT_CATEGORY_IMAGE_POSITIONS[category.key],
      gifts: category.gifts.map(cloneGift),
    })),
  };
}

export function loadExperienceConfig(): ExperienceConfig {
  const fallback = createDefaultExperienceConfig();

  try {
    const rawConfig = window.localStorage.getItem(EXPERIENCE_CONFIG_STORAGE_KEY);
    if (!rawConfig) {
      return fallback;
    }

    const parsed = JSON.parse(rawConfig) as ExperienceConfig;
    if (!parsed || !Array.isArray(parsed.categories)) {
      return fallback;
    }

    return {
      introVideoPath:
        parsed.introVideoPath && parsed.introVideoPath !== '/video/birthday-intro.mp4'
          ? parsed.introVideoPath
          : fallback.introVideoPath,
      introPosterPath: parsed.introPosterPath || fallback.introPosterPath,
      categories: fallback.categories.map((fallbackCategory) => {
        const storedCategory = parsed.categories.find((category) => category.key === fallbackCategory.key);
        if (!storedCategory) {
          return cloneCategory(fallbackCategory);
        }

        return {
          ...fallbackCategory,
          ...storedCategory,
          imagePath: storedCategory.imagePath || fallbackCategory.imagePath,
          imagePosition: storedCategory.imagePosition || fallbackCategory.imagePosition,
          gifts: Array.isArray(storedCategory.gifts) && storedCategory.gifts.length > 0
            ? storedCategory.gifts.map((gift) => ({
                name: gift.name || '',
                price: Number.isFinite(Number(gift.price)) ? Number(gift.price) : 0,
              }))
            : fallbackCategory.gifts.map(cloneGift),
        };
      }),
    };
  } catch {
    return fallback;
  }
}

export function saveExperienceConfig(config: ExperienceConfig) {
  window.localStorage.setItem(EXPERIENCE_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function serializeExperienceConfig(config: ExperienceConfig) {
  return JSON.stringify(config, null, 2);
}
