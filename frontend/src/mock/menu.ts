import type { Category, MenuItem } from '../types'

/**
 * MOCK DATA — stands in for:
 *   GET  /api/categories
 *   GET  /api/categories/{category}
 *   GET  /api/menu
 *   GET  /api/menu/{menu_item}
 *   POST|PUT|PATCH|DELETE /api/admin/menu-items[/{menu_item}]
 *   POST|PUT|PATCH|DELETE /api/admin/categories[/{category}]
 *
 * TODO(next-dev): swap for the real axios calls, e.g.
 *   const { data } = await api.get<MenuItem[]>('/menu', { params })
 *   return data.data ?? data
 *
 * Auth: the GETs are public. All writes require an admin token.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THIS PAGE CANNOT BE WIRED UP AS-IS. Two backend gaps:
 *
 * 1. `GET /api/menu` PAGINATES AND HAS NO SEARCH.
 *      MenuItemController.php:17-23
 *        MenuItem::query()
 *          ->when($request->query('category_id'), ...)            ✅ supported
 *          ->when($request->query('available') === 'true', ...)   ✅ supported
 *          ->when($request->query('featured') === 'true', ...)    ✅ supported
 *          ->with('category', 'variantGroups.options')            ✅ eager loads
 *          ->orderBy('name')
 *          ->paginate($request->perPage(15));
 *    There is NO search term, and it returns 15 per page. The Menu page has a
 *    free-text search box and shows every row at once. Either:
 *      a) add a `search` filter to MenuItemController@index + pagination UI, or
 *      b) request `per_page=100` and keep filtering in the browser — sensible
 *         for a single restaurant (16 items here; 100 is plenty).
 *
 * 2. `POST /api/admin/menu-items` REQUIRES `slug`.
 *      MenuItemController.php:40
 *        'slug' => ['required', 'string', 'max:180', 'unique:menu_items,slug'],
 *    The create/edit form has no slug input. Either add the field, auto-derive
 *    it client-side (slugify(name)), or have the backend derive it. Same applies
 *    to categories (CategoryController.php:39).
 *
 * ---------------------------------------------------------------------------
 * FIELD → COLUMN MAP (menu_items)
 * Mirrors backend/database/migrations/2026_09_15_000005_create_menu_items_table.php
 * ---------------------------------------------------------------------------
 *   MenuItem.id                       → id
 *   MenuItem.category_id              → category_id   FK categories
 *   MenuItem.name                     → name
 *   MenuItem.slug                     → slug          UNIQUE, required on create
 *   MenuItem.description              → description   nullable
 *   MenuItem.sku                      → sku           nullable, UNIQUE
 *   MenuItem.base_price               → base_price    numeric, min 0
 *   MenuItem.image_url                → image_url     nullable
 *   MenuItem.is_available             → is_available  ← drives the sold-out badge
 *   MenuItem.is_featured              → is_featured
 *   MenuItem.preparation_time_minutes → preparation_time_minutes
 *   MenuItem.calories                 → calories      nullable
 *   MenuItem.deleted_at               → SoftDeletes
 *
 * ⚠️ base_price is numeric → arrives as a STRING. The migration also adds a
 *    Postgres-only CHECK: menu_items_base_price_check (base_price >= 0).
 *
 * GET /api/menu also eager-loads `category` and `variantGroups.options`, so a
 * real response carries an embedded `category` object rather than just the FK.
 * This fixture keeps `category_id` and resolves names via categoryName() below;
 * swap to `item.category?.name` once real data lands.
 *
 * ---------------------------------------------------------------------------
 * image_url
 * ---------------------------------------------------------------------------
 * These are LOCAL SVG PLACEHOLDERS, not photography. JALIKUD has no product
 * photos yet — and neither does the mobile app, which uses an `emoji` field
 * (mobile/src/app/(tabs)/menu.tsx:33) and imports no <Image> at all. Copying
 * assets from mobile was not an option: the only PNGs there are app icons and
 * tab-bar glyphs.
 *
 * So the placeholders are generated locally by:
 *     node scripts/generate-menu-placeholders.mjs
 * → public/images/menu/<slug>.svg   (18 files, 0.48 KB each, 8.7 KB total)
 *
 * Each is a category-tinted rounded square with the item's emoji, using the
 * mobile palette so both clients read as the same product.
 *
 * TO SWAP IN REAL PHOTOS: set `image_url` on each row to the uploaded URL,
 * delete public/images/menu/ and the script. No component changes — every
 * consumer renders whatever `image_url` holds.
 *
 * ⚠️ These are paths, not absolute URLs. The backend's `image_url` will hold
 *    absolute URLs (or null), so treat this as design-time only.
 */

const iso = (value: string): string => value

export const mockCategories: Category[] = [
  {
    id: 1,
    parent_id: null,
    name: 'Chickenjoy',
    slug: 'chickenjoy',
    description: 'Our signature fried chicken, crispy outside and juicy inside.',
    image_url: null,
    sort_order: 1,
    is_active: true,
    created_at: iso('2026-09-15T02:10:00+08:00'),
    updated_at: iso('2026-09-15T02:10:00+08:00'),
  },
  {
    id: 2,
    parent_id: null,
    name: 'Burgers',
    slug: 'burgers',
    description: 'Flame-grilled patties in toasted sesame buns.',
    image_url: null,
    sort_order: 2,
    is_active: true,
    created_at: iso('2026-09-15T02:11:00+08:00'),
    updated_at: iso('2026-09-15T02:11:00+08:00'),
  },
  {
    id: 3,
    parent_id: null,
    name: 'Rice Meals',
    slug: 'rice-meals',
    description: 'Generous servings of rice with your choice of protein.',
    image_url: null,
    sort_order: 3,
    is_active: true,
    created_at: iso('2026-09-15T02:12:00+08:00'),
    updated_at: iso('2026-09-15T02:12:00+08:00'),
  },
  {
    id: 4,
    parent_id: null,
    name: 'Pasta',
    slug: 'pasta',
    description: 'Comfort classics, made fresh to order.',
    image_url: null,
    sort_order: 4,
    is_active: true,
    created_at: iso('2026-09-15T02:13:00+08:00'),
    updated_at: iso('2026-09-15T02:13:00+08:00'),
  },
  {
    id: 5,
    parent_id: null,
    name: 'Sides',
    slug: 'sides',
    description: 'Crispy favourites and dips to share.',
    image_url: null,
    sort_order: 5,
    is_active: true,
    created_at: iso('2026-09-15T02:14:00+08:00'),
    updated_at: iso('2026-09-15T02:14:00+08:00'),
  },
  {
    id: 6,
    parent_id: null,
    name: 'Drinks',
    slug: 'drinks',
    description: 'Ice-cold refreshers to wash it down.',
    image_url: null,
    sort_order: 6,
    is_active: true,
    created_at: iso('2026-09-15T02:15:00+08:00'),
    updated_at: iso('2026-09-15T02:15:00+08:00'),
  },
{
    id: 7,
    parent_id: null,
    name: 'Desserts',
    slug: 'desserts',
    description: 'Sweet treats to finish the meal.',
    image_url: null,
    sort_order: 7,
    is_active: true,
    created_at: iso('2026-09-29T04:10:00+08:00'),
    updated_at: iso('2026-09-29T04:10:00+08:00'),
  },
]

export const mockMenuItems: MenuItem[] = [
  {
    id: 1,
    category_id: 1,
    name: 'Chickenjoy 1pc',
    slug: 'chickenjoy-1pc',
    image_url: '/images/menu/chickenjoy-1pc.svg',
    description: 'One piece of our signature fried chicken with garlic dip.',
    sku: 'CJ-001',
    base_price: '109.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 8,
    calories: 380,
    created_at: iso('2026-09-15T02:20:00+08:00'),
    updated_at: iso('2026-09-15T02:20:00+08:00'),
    deleted_at: null,
  },
  {
    id: 2,
    category_id: 1,
    name: 'Chickenjoy 2pc',
    slug: 'chickenjoy-2pc',
    image_url: '/images/menu/chickenjoy-2pc.svg',
    description: 'Two pieces with two garlic dips. Serves one.',
    sku: 'CJ-002',
    base_price: '199.00',

    is_available: true,
    is_featured: true,
    preparation_time_minutes: 9,
    calories: 720,
    created_at: iso('2026-09-15T02:21:00+08:00'),
    updated_at: iso('2026-09-15T02:21:00+08:00'),
    deleted_at: null,
  },
  {
    id: 3,
    category_id: 1,
    name: 'Chickenjoy 6pc',
    slug: 'chickenjoy-6pc',
    image_url: '/images/menu/chickenjoy-6pc.svg',
    description: 'Family size bucket. Great for sharing.',
    sku: 'CJ-006',
    base_price: '549.00',

    is_available: true,
    is_featured: true,
    preparation_time_minutes: 15,
    calories: 2180,
    created_at: iso('2026-09-15T02:22:00+08:00'),
    updated_at: iso('2026-09-15T02:22:00+08:00'),
    deleted_at: null,
  },
  {
    id: 4,
    category_id: 1,
    name: 'Chickenjoy 8pc Family',
    slug: 'chickenjoy-8pc-family',
    image_url: '/images/menu/chickenjoy-8pc-family.svg',
    description: 'The whole crew. Eight pieces, four dips.',
    sku: 'CJ-008',
    base_price: '729.00',

    is_available: false,
    is_featured: false,
    preparation_time_minutes: 18,
    calories: 2900,
    created_at: iso('2026-09-15T02:23:00+08:00'),
    updated_at: iso('2026-09-28T14:02:00+08:00'),
    deleted_at: null,
  },
  {
    id: 5,
    category_id: 2,
    name: 'Yumburger',
    slug: 'yumburger',
    image_url: '/images/menu/yumburger.svg',
    description: 'Flame-grilled beef patty, cheese, lettuce, special sauce.',
    sku: 'BG-001',
    base_price: '89.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 6,
    calories: 420,
    created_at: iso('2026-09-15T02:24:00+08:00'),
    updated_at: iso('2026-09-15T02:24:00+08:00'),
    deleted_at: null,
  },
  {
    id: 6,
    category_id: 2,
    name: 'Champ Burger',
    slug: 'champ-burger',
    image_url: '/images/menu/champ-burger.svg',
    description: 'Double patty, ham, cheese and barbecue sauce.',
    sku: 'BG-002',
    base_price: '179.00',

    is_available: true,
    is_featured: true,
    preparation_time_minutes: 10,
    calories: 810,
    created_at: iso('2026-09-15T02:25:00+08:00'),
    updated_at: iso('2026-09-15T02:25:00+08:00'),
    deleted_at: null,
  },
  {
    id: 7,
    category_id: 2,
    name: 'Chicken & Burger Combo',
    slug: 'chicken-burger-combo',
    image_url: '/images/menu/chicken-burger-combo.svg',
    description: 'Chickenjoy 1pc and a Yumburger with a drink.',
    sku: 'BG-003',
    base_price: '249.00',

    is_available: true,
    is_featured: true,
    preparation_time_minutes: 12,
    calories: 940,
    created_at: iso('2026-09-15T02:26:00+08:00'),
    updated_at: iso('2026-09-15T02:26:00+08:00'),
    deleted_at: null,
  },
  {
    id: 8,
    category_id: 3,
    name: 'Burger Steak',
    slug: 'burger-steak',
    image_url: '/images/menu/burger-steak.svg',
    description: 'Beef patty over garlic-flavoured rice.',
    sku: 'RM-001',
    base_price: '139.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 9,
    calories: 690,
    created_at: iso('2026-09-15T02:27:00+08:00'),
    updated_at: iso('2026-09-15T02:27:00+08:00'),
    deleted_at: null,
  },
  {
    id: 9,
    category_id: 3,
    name: '1pc Burger Steak Solo',
    slug: 'burger-steak-solo',
    image_url: '/images/menu/burger-steak-solo.svg',
    description: 'Single serving with a side of rice.',
    sku: 'RM-002',
    base_price: '99.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 8,
    calories: 560,
    created_at: iso('2026-09-15T02:28:00+08:00'),
    updated_at: iso('2026-09-15T02:28:00+08:00'),
    deleted_at: null,
  },
  {
    id: 10,
    category_id: 3,
    name: 'Chickenjoy 2pc Rice Meal',
    slug: 'chickenjoy-2pc-rice-meal',
    image_url: '/images/menu/chickenjoy-2pc-rice-meal.svg',
    description: 'Two pieces chicken with java rice.',
    sku: 'RM-003',
    base_price: '259.00',

    is_available: false,
    is_featured: false,
    preparation_time_minutes: 13,
    calories: 1050,
    created_at: iso('2026-09-15T02:29:00+08:00'),
    updated_at: iso('2026-09-28T09:41:00+08:00'),
    deleted_at: null,
  },
  {
    id: 11,
    category_id: 4,
    name: 'Jolly Spaghetti',
    slug: 'jolly-spaghetti',
    image_url: '/images/menu/jolly-spaghetti.svg',
    description: 'Sweet-style spaghetti with the iconic red sauce.',
    sku: 'PS-001',
    base_price: '99.00',

    is_available: true,
    is_featured: true,
    preparation_time_minutes: 10,
    calories: 540,
    created_at: iso('2026-09-15T02:30:00+08:00'),
    updated_at: iso('2026-09-15T02:30:00+08:00'),
    deleted_at: null,
  },
  {
    id: 12,
    category_id: 4,
    name: 'Spaghetti Aglio Olio',
    slug: 'spaghetti-agnolio',
    image_url: '/images/menu/spaghetti-agnolio.svg',
    description: 'Garlic, olive oil, chilli flakes and parsley.',
    sku: 'PS-002',
    base_price: '119.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 11,
    calories: 480,
    created_at: iso('2026-09-15T02:31:00+08:00'),
    updated_at: iso('2026-09-15T02:31:00+08:00'),
    deleted_at: null,
  },
  {
    id: 13,
    category_id: 5,
    name: 'Crispy Fries',
    slug: 'crispy-fries',
    image_url: '/images/menu/crispy-fries.svg',
    description: 'Seasoned fries with ketchup on the side.',
    sku: 'SD-001',
    // Priced to match mobile, which values "Free Regular Fries" at ₱79.00.
    // Previously 59.00 here and ₱79 there — reconciled 2026-09-29.
    base_price: '79.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 5,
    calories: 320,
    created_at: iso('2026-09-15T02:32:00+08:00'),
    updated_at: iso('2026-09-15T02:32:00+08:00'),
    deleted_at: null,
  },
  {
    id: 14,
    category_id: 5,
    name: 'Jolly Fries Bucket',
    slug: 'jolly-fries-bucket',
    image_url: '/images/menu/jolly-fries-bucket.svg',
    description: 'Sharing bucket with two dips.',
    sku: 'SD-002',
    base_price: '149.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 7,
    calories: 780,
    created_at: iso('2026-09-15T02:33:00+08:00'),
    updated_at: iso('2026-09-15T02:33:00+08:00'),
    deleted_at: null,
  },
  {
    id: 15,
    category_id: 6,
    name: 'Sotanghon',
    slug: 'sotanghon',
    image_url: '/images/menu/sotanghon.svg',
    description: 'Classic Filipino egg noodle soup.',
    sku: 'DR-001',
    base_price: '49.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 5,
    calories: 260,
    created_at: iso('2026-09-15T02:34:00+08:00'),
    updated_at: iso('2026-09-15T02:34:00+08:00'),
    deleted_at: null,
  },
  {
    id: 16,
    category_id: 6,
    name: 'Coke Float',
    slug: 'coke-float',
    image_url: '/images/menu/coke-float.svg',
    description: 'Chilled soda with a scoop of vanilla ice cream.',
    sku: 'DR-002',
    base_price: '65.00',

    is_available: true,
    is_featured: true,
    preparation_time_minutes: 4,
    calories: 310,
    created_at: iso('2026-09-15T02:35:00+08:00'),
    updated_at: iso('2026-09-15T02:35:00+08:00'),
    deleted_at: null,
  },

  // ---- Added to back rewards 5 and 6 ----
  // These two existed only as rewards on mobile
  // (mobile/src/app/(tabs)/rewards.tsx:58-72) with no matching catalogue entry,
  // so `free_item` rewards had a null menu_item_id. Added 2026-09-29 with the
  // cash values mobile implied, so the redemption can be honoured.
  {
    id: 17,
    category_id: 7,
    name: 'Peach Mango Pie',
    slug: 'peach-mango-pie',
    image_url: '/images/menu/peach-mango-pie.svg',
    description: 'Warm flaky crust with sweet mango filling.',
    sku: 'DS-001',
    base_price: '45.00',

    is_available: true,
    is_featured: true,
    preparation_time_minutes: 3,
    calories: 280,
    created_at: iso('2026-09-29T04:10:00+08:00'),
    updated_at: iso('2026-09-29T04:10:00+08:00'),
    deleted_at: null,
  },
  {
    id: 18,
    category_id: 7,
    name: 'Sundae Cup',
    slug: 'sundae-cup',
    image_url: '/images/menu/sundae-cup.svg',
    description: 'Classic soft-serve in a cup.',
    sku: 'DS-002',
    base_price: '39.00',

    is_available: true,
    is_featured: false,
    preparation_time_minutes: 2,
    calories: 210,
    created_at: iso('2026-09-29T04:11:00+08:00'),
    updated_at: iso('2026-09-29T04:11:00+08:00'),
    deleted_at: null,
  },
]

export function findMenuItem(id: number): MenuItem | undefined {
  return mockMenuItems.find((item) => item.id === id)
}

export function categoryName(id: number): string {
  return mockCategories.find((category) => category.id === id)?.name ?? 'Uncategorised'
}

/* -------------------------------------------------------------------------
 * VARIANTS
 *
 * The backend HAS these tables (migrations …_000006 variant_groups and
 * …_000007 variant_options) and `MenuItemController@index` eager-loads them:
 *
 *   MenuItemController.php:21
 *     ->with('category', 'variantGroups.options')
 *
 * …but there is NO endpoint that creates or edits them. VariantGroup and
 * VariantOption have zero routes. So they are read-only for now: if you change
 * variants by hand you need new admin routes —
 *
 *   POST|PUT|DELETE /api/admin/menu-items/{menu_item}/variant-groups
 *   POST|PUT|DELETE /api/admin/variant-groups/{variant_group}
 *
 * Note price_delta is a STRING (numeric column) and it ADDS to base_price.
 * A variant group with selection_type 'single' + is_required true means the
 * customer must pick exactly one option; 'multiple' + min/max_select bounds it.
 * ---------------------------------------------------------------------- */


