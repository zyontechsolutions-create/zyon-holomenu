// Re-exported from RestaurantContext so this resolves ONCE per session
// (via the RestaurantProvider in the panel layout) instead of being
// re-fetched from scratch every time a page component mounts.
export { useActiveRestaurant } from "./RestaurantContext";
export type { ActiveRestaurant } from "./RestaurantContext";
