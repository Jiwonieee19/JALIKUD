<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\MenuItem;
use App\Models\VariantOption;
use Illuminate\Support\Collection;

/**
 * Server-authoritative cart pricing and variant option validation.
 *
 * Prices are re-read from the catalog at checkout so a client can never
 * control what it pays via a stale cart snapshot, and option selections
 * are validated against the menu item's own variant groups.
 */
class CartPricingService
{
    /**
     * Re-price every cart line against the current catalog.
     *
     * @return array{lines: Collection, errors: string[], subtotal: float}
     */
    public function price(Cart $cart): array
    {
        $items = $cart->cartItems()->with('options.variantOption')->get();

        $menuItems = MenuItem::withTrashed()
            ->whereIn('id', $items->pluck('menu_item_id')->all())
            ->get()
            ->keyBy('id');

        $errors = [];

        $lines = $items->map(function (CartItem $item) use ($menuItems, &$errors) {
            $menuItem = $menuItems->get($item->menu_item_id);

            if ($menuItem === null || $menuItem->trashed() || ! $menuItem->is_available) {
                $errors[] = ($menuItem?->name ?? 'A cart item').' is no longer available.';

                return null;
            }

            $unitPrice = round((float) $menuItem->base_price, 2);

            $options = $item->options
                ->map(fn ($cartOption) => [
                    'variant_option_id' => $cartOption->variant_option_id,
                    'option_name' => $cartOption->variantOption?->name ?? 'Option',
                    'price_delta' => round((float) ($cartOption->variantOption?->price_delta ?? 0), 2),
                ])
                ->values()
                ->all();

            $deltaSum = array_sum(array_column($options, 'price_delta'));

            return [
                'cart_item' => $item,
                'menu_item' => $menuItem,
                'unit_price' => $unitPrice,
                'quantity' => (int) $item->quantity,
                'options' => $options,
                'line_total' => round(($unitPrice + $deltaSum) * (int) $item->quantity, 2),
            ];
        })->filter()->values();

        return [
            'lines' => $lines,
            'errors' => $errors,
            'subtotal' => round((float) $lines->sum('line_total'), 2),
        ];
    }

    /**
     * Variant option ids a customer may legitimately select for this item:
     * live options inside the item's own variant groups.
     *
     * @return array<int>
     */
    public function selectableOptionIds(MenuItem $menuItem): array
    {
        return VariantOption::query()
            ->where('is_available', true)
            ->whereIn('variant_group_id', $menuItem->variantGroups()->pluck('id'))
            ->pluck('id')
            ->all();
    }

    /**
     * Validate a requested option selection against the item's variant groups
     * (ownership, single/multiple, required, min/max). Returns problem strings.
     *
     * @param  array<int>  $optionIds
     * @param  array<int>  $selectable
     * @return string[]
     */
    public function optionSelectionErrors(MenuItem $menuItem, array $optionIds, array $selectable): array
    {
        $requested = collect($optionIds)->map(fn ($id) => (int) $id)->unique();

        $errors = [];

        if ($requested->diff($selectable)->isNotEmpty()) {
            $errors[] = 'One or more selected options are not available for this item.';
        }

        foreach ($menuItem->variantGroups()->with('variantOptions')->get() as $group) {
            $chosen = $requested->intersect($group->variantOptions->pluck('id'))->count();

            if ($group->is_required && $chosen === 0) {
                $errors[] = "Selection required: {$group->name}.";
            }

            if ($chosen > 0 && $chosen < (int) $group->min_select) {
                $errors[] = "Select at least {$group->min_select} option(s) for {$group->name}.";
            }

            $max = $group->selection_type === 'multiple' ? $group->max_select : 1;

            if ($max !== null && $chosen > (int) $max) {
                $limit = $group->selection_type === 'multiple' ? "at most {$max}" : 'only 1';
                $errors[] = "Select {$limit} option(s) for {$group->name}.";
            }
        }

        return $errors;
    }
}