// tarkov.dev's item and category pictures, loaded from its asset host (the only remote image
// host the app's CSP allows). The data carries picture ids, not URLs, so a host change is one edit.
import itemCategories from "../../../data/itemCategories.json";

const CATEGORY_IMAGES = (itemCategories as { categoryImages: Record<string, string> }).categoryImages;

/** The picture of an item, by the picture id the data carries (the item's own id, or the one it borrows). */
export function itemImageUrl(imageId: string): string {
  return `https://assets.tarkov.dev/${imageId}-base-image.webp`;
}

/** The picture of a handbook category (tarkov.dev's loose loot filter rows), by slug. */
export function lootCategoryImage(slug: string): string | undefined {
  return CATEGORY_IMAGES[slug];
}
