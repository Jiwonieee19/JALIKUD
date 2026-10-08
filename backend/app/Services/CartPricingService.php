<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\MenuItem;
use App\Models\StoreSetting;
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
     * Build the single, server-authoritative cart representation returned by
     * every cart endpoint. Money values intentionally follow the rest of the
     * API and are serialized as two-decimal strings.
     *
     * @return array<string, mixed>
     */
    public function serialize(Cart $cart, int $userId): array
    {
        $cart->load(['cartItems.menuItem', 'cartItems.options.variantOption', 'address', 'coupon']);

        $priced = $this->price($cart);
        $lines = $priced['lines']->keyBy(fn (array $line) => $line['cart_item']->id);
        $data = $cart->toArray();

        $data['cart_items'] = collect($data['cart_items'])->map(function (array $item) use ($lines) {
            $line = $lines->get($item['id']);

            if ($line === null) {
                $item['line_total'] = $this->money(0);

                return $item;
            }

            $item['unit_price'] = $this->money($line['unit_price']);
            $optionPrices = collect($line['options'])->keyBy('variant_option_id');
            $item['options'] = collect($item['options'])->map(function (array $option) use ($optionPrices) {
                $live = $optionPrices->get($option['variant_option_id']);

                if ($live !== null) {
                    $option['price_delta'] = $this->money($live['price_delta']);

                    if (isset($option['variant_option'])) {
                        $option['variant_option']['price_delta'] = $this->money($live['price_delta']);
                    }
                }

                return $option;
            })->values()->all();
            $item['line_total'] = $this->money($line['line_total']);

            return $item;
        })->values()->all();

        $subtotal = $priced['subtotal'];
        $errors = $priced['errors'];
        $discount = 0.0;

        if ($cart->coupon !== null) {
            $reason = $cart->coupon->rejectionReason($subtotal, $userId);

            if ($reason === null) {
                $discount = $cart->coupon->discountFor($subtotal);
            } else {
                $errors[] = $reason;
            }
        }

        // Reserved (not yet deducted) reward: free food discounts one live
        // unit; vouchers discount a flat amount over a minimum subtotal.
        // Rewards never stack with coupons; combined discounts cap at subtotal.
        $rewardDiscount = 0.0;
        $reward = null;
        $rewardKey = $cart->reward_key;

        if ($rewardKey !== null && $rewardKey !== '') {
            $definition = PointLedger::definition($rewardKey);

            if ($definition === null) {
                $errors[] = 'Selected reward is no longer available.';
            } elseif ($cart->coupon_id !== null) {
                $errors[] = 'Rewards cannot be combined with a coupon.';
            } elseif (($definition['type'] ?? null) === 'free_item') {
                $menuItemId = (int) ($definition['menu_item_id'] ?? 0);
                $match = $priced['lines']->first(
                    fn (array $line) => $line['menu_item']->id === $menuItemId
                );

                if ($match === null) {
                    $errors[] = "Add {$definition['label']} to your cart to use this reward.";
                } else {
                    $rewardDiscount = round((float) $match['unit_price'], 2);
                    $reward = ['key' => $rewardKey, 'label' => $definition['label']];
                }
            } elseif (($definition['type'] ?? null) === 'voucher') {
                $minimum = (float) ($definition['min_order_amount'] ?? 0);

                if ($subtotal < $minimum) {
                    $errors[] = "This reward needs a subtotal of at least ₱".number_format($minimum, 2).'.';
                } else {
                    $rewardDiscount = round((float) ($definition['discount_amount'] ?? 0), 2);
                    $reward = ['key' => $rewardKey, 'label' => $definition['label']];
                }
            } else {
                $errors[] = 'Selected reward is no longer available.';
            }

            $rewardDiscount = max(0.0, min($rewardDiscount, $subtotal - $discount));
        }

        $settings = StoreSetting::query()->first();
        $deliveryFee = $cart->order_type === 'delivery'
            ? round((float) ($settings?->delivery_fee ?? 0), 2)
            : 0.0;
        $tax = round($subtotal * ((float) ($settings?->tax_rate_percent ?? 0) / 100), 2);

        $data['subtotal'] = $this->money($subtotal);
        $data['discount_amount'] = $this->money($discount);
        $data['reward'] = $reward;
        $data['reward_discount_amount'] = $this->money($rewardDiscount);
        $data['delivery_fee'] = $this->money($deliveryFee);
        $data['tax_amount'] = $this->money($tax);
        $data['total_amount'] = $this->money($subtotal - $discount - $rewardDiscount + $deliveryFee + $tax);
        $data['pricing_errors'] = array_values($errors);

        return $data;
    }

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

    private function money(float|int|string $amount): string
    {
        return number_format(round((float) $amount, 2), 2, '.', '');
    }
}
