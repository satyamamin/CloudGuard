// Single source of truth for the product's display name — read from
// NEXT_PUBLIC_PRODUCT_NAME (apps/web/.env.local) so a future rename touches
// one place instead of hunting down every literal string in UI copy.
export const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "FinOps Lab";
