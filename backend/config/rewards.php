<?php

/**
 * Redeemable reward catalog. Keys are stored on carts (reward_key) and
 * orders, so renaming a key orphans in-flight carts by design — the pricing
 * layer then reports the reward as unavailable instead of mispricing.
 *
 * free_item: discounts ONE unit of the named menu item at its live price.
 *   The item must be present and available in the cart.
 * voucher: flat discount gated on a minimum subtotal.
 */
return [
    // 1 point per this many pesos of paid order total.
    'pesos_per_point' => 10,

    'definitions' => [
        'chickenjoy-1pc' => [
            'type' => 'free_item',
            'label' => 'Free Chickenjoy 1pc',
            'menu_item_slug' => 'chickenjoy-1pc',
            'points_cost' => 500,
        ],
        'yumburger' => [
            'type' => 'free_item',
            'label' => 'Free Yumburger',
            'menu_item_slug' => 'yumburger',
            'points_cost' => 350,
        ],
        'voucher-100' => [
            'type' => 'voucher',
            'label' => '₱100 Off Voucher',
            'discount_amount' => 100,
            'min_order_amount' => 300,
            'points_cost' => 750,
        ],
    ],
];
