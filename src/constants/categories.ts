// Central definition of trackable price categories — a fixed, curated
// list (not free text) is what makes crowdsourced comparison work at all:
// everyone logging "Eggs" gets averaged together, but "eggs" vs "Eggs" vs
// "large eggs" typed as free text would never group together. Adding an
// item means adding one entry here AND to the `category in [...]` list in
// firestore.rules — every screen (quick log, dashboard, map filters)
// reads from this list instead of hardcoding category names.
import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type CategoryId =
  | 'gas'
  | 'milk'
  | 'eggs'
  | 'bread'
  | 'ground_beef'
  | 'chicken_breast'
  | 'bacon'
  | 'pork_chops'
  | 'fish'
  | 'cheese'
  | 'butter'
  | 'yogurt'
  | 'rice'
  | 'pasta'
  | 'cereal'
  | 'flour'
  | 'tortillas'
  | 'sugar'
  | 'cooking_oil'
  | 'peanut_butter'
  | 'canned_beans'
  | 'canned_soup'
  | 'apples'
  | 'bananas'
  | 'oranges'
  | 'orange_juice'
  | 'potatoes'
  | 'onions'
  | 'tomatoes'
  | 'lettuce'
  | 'broccoli'
  | 'carrots'
  | 'coffee'
  | 'soda'
  | 'bottled_water'
  | 'toilet_paper'
  | 'paper_towels'
  | 'laundry_detergent'
  | 'dish_soap'
  | 'trash_bags'
  | 'diapers'
  | 'baby_formula'
  // Added because BLS publishes a current average-price series for each
  // of these, so they arrive with real national data to compare against
  // rather than being one more item with nothing behind it.
  | 'steak'
  | 'beef_roast'
  | 'whole_chicken'
  | 'ice_cream'
  | 'dried_beans';

// Pulls the exact union of valid glyph names straight from the icon
// component's own prop type, so a typo here (e.g. "bread-slice") is a
// compile error instead of a silently-missing icon at runtime. Some items
// below use a generic/approximate icon rather than an exact match — this
// icon set doesn't have one for every grocery item, and with 40+ items,
// the search box (not visual browsing) is the primary way to find one
// anyway, so an approximate icon is an acceptable trade-off.
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface CategoryDef {
  id: CategoryId;
  label: string;
  unit: string; // set automatically based on category, never user-entered
  icon: IconName;
  color: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'gas', label: 'Gas', unit: 'per gallon', icon: 'gas-station', color: '#E4572E' },
  { id: 'milk', label: 'Milk', unit: 'per gallon', icon: 'cup', color: '#4C6EF5' },
  { id: 'eggs', label: 'Eggs', unit: 'per dozen', icon: 'egg', color: '#F2B705' },
  { id: 'bread', label: 'Bread', unit: 'per loaf', icon: 'bread-slice', color: '#A9714B' },
  { id: 'ground_beef', label: 'Ground Beef', unit: 'per lb', icon: 'food-steak', color: '#C0392B' },
  {
    id: 'chicken_breast',
    label: 'Chicken Breast',
    unit: 'per lb',
    icon: 'food-drumstick',
    color: '#D97706',
  },
  { id: 'bacon', label: 'Bacon', unit: 'per lb', icon: 'pig-variant-outline', color: '#EC7C6B' },
  { id: 'pork_chops', label: 'Pork Chops', unit: 'per lb', icon: 'pig-variant', color: '#F08A5D' },
  { id: 'fish', label: 'Fish', unit: 'per lb', icon: 'fish', color: '#0EA5E9' },
  { id: 'cheese', label: 'Cheese', unit: 'per lb', icon: 'cheese', color: '#FACC15' },
  { id: 'butter', label: 'Butter', unit: 'per lb', icon: 'rectangle', color: '#FDE68A' },
  { id: 'yogurt', label: 'Yogurt', unit: 'per container', icon: 'cup', color: '#93C5FD' },
  { id: 'rice', label: 'Rice', unit: 'per lb', icon: 'rice', color: '#94A3B8' },
  { id: 'pasta', label: 'Pasta', unit: 'per lb', icon: 'pasta', color: '#EAB308' },
  { id: 'cereal', label: 'Cereal', unit: 'per box', icon: 'bowl', color: '#FBBF24' },
  { id: 'flour', label: 'Flour', unit: 'per bag', icon: 'basket-outline', color: '#D6B98C' },
  { id: 'tortillas', label: 'Tortillas', unit: 'per pack', icon: 'food-variant', color: '#E0B589' },
  { id: 'sugar', label: 'Sugar', unit: 'per bag', icon: 'cube-outline', color: '#94A3B8' },
  { id: 'cooking_oil', label: 'Cooking Oil', unit: 'per bottle', icon: 'oil', color: '#CA8A04' },
  {
    id: 'peanut_butter',
    label: 'Peanut Butter',
    unit: 'per jar',
    icon: 'peanut',
    color: '#B45309',
  },
  {
    id: 'canned_beans',
    label: 'Canned Beans',
    unit: 'per can',
    icon: 'package-variant',
    color: '#78716C',
  },
  {
    id: 'canned_soup',
    label: 'Canned Soup',
    unit: 'per can',
    icon: 'package-variant-closed',
    color: '#57534E',
  },
  { id: 'apples', label: 'Apples', unit: 'per lb', icon: 'food-apple', color: '#DC2626' },
  { id: 'bananas', label: 'Bananas', unit: 'per lb', icon: 'food-apple-outline', color: '#FACC15' },
  { id: 'oranges', label: 'Oranges', unit: 'per lb', icon: 'fruit-citrus', color: '#FB923C' },
  {
    id: 'orange_juice',
    label: 'Orange Juice',
    unit: 'per half gallon',
    icon: 'fruit-citrus',
    color: '#F97316',
  },
  { id: 'potatoes', label: 'Potatoes', unit: 'per lb', icon: 'basket-outline', color: '#A16207' },
  { id: 'onions', label: 'Onions', unit: 'per lb', icon: 'food-variant', color: '#C084FC' },
  { id: 'tomatoes', label: 'Tomatoes', unit: 'per lb', icon: 'circle', color: '#EF4444' },
  { id: 'lettuce', label: 'Lettuce', unit: 'per head', icon: 'leaf', color: '#22C55E' },
  { id: 'broccoli', label: 'Broccoli', unit: 'per lb', icon: 'tree', color: '#16A34A' },
  { id: 'carrots', label: 'Carrots', unit: 'per lb', icon: 'carrot', color: '#F97316' },
  { id: 'coffee', label: 'Coffee', unit: 'per lb', icon: 'coffee', color: '#6F4E37' },
  { id: 'soda', label: 'Soda', unit: 'per 2-liter', icon: 'bottle-soda-classic', color: '#DC2626' },
  {
    id: 'bottled_water',
    label: 'Bottled Water',
    unit: 'per case',
    icon: 'water',
    color: '#38BDF8',
  },
  {
    id: 'toilet_paper',
    label: 'Toilet Paper',
    unit: 'per roll',
    icon: 'paper-roll',
    color: '#14B8A6',
  },
  {
    id: 'paper_towels',
    label: 'Paper Towels',
    unit: 'per roll',
    icon: 'paper-roll',
    color: '#0D9488',
  },
  {
    id: 'laundry_detergent',
    label: 'Laundry Detergent',
    unit: 'per bottle',
    icon: 'washing-machine',
    color: '#6366F1',
  },
  {
    id: 'dish_soap',
    label: 'Dish Soap',
    unit: 'per bottle',
    icon: 'spray-bottle',
    color: '#22D3EE',
  },
  { id: 'trash_bags', label: 'Trash Bags', unit: 'per box', icon: 'trash-can', color: '#475569' },
  {
    id: 'diapers',
    label: 'Diapers',
    unit: 'per pack',
    icon: 'baby-face-outline',
    color: '#F472B6',
  },
  {
    id: 'baby_formula',
    label: 'Baby Formula',
    unit: 'per container',
    icon: 'baby-bottle',
    color: '#FBCFE8',
  },
  { id: 'steak', label: 'Steak', unit: 'per lb', icon: 'food-steak', color: '#991B1B' },
  { id: 'beef_roast', label: 'Beef Roast', unit: 'per lb', icon: 'food-variant', color: '#B91C1C' },
  {
    id: 'whole_chicken',
    label: 'Whole Chicken',
    unit: 'per lb',
    icon: 'food-turkey',
    color: '#F59E0B',
  },
  {
    id: 'ice_cream',
    label: 'Ice Cream',
    unit: 'per half gallon',
    icon: 'ice-cream',
    color: '#F9A8D4',
  },
  { id: 'dried_beans', label: 'Dried Beans', unit: 'per lb', icon: 'seed', color: '#92400E' },
];

export function getCategory(id: CategoryId): CategoryDef {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category id: ${id}`);
  return found;
}
