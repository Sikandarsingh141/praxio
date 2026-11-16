export interface ShopAddressParts {
  address?: string | null;
  street?: string | null;
  area?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export function formatShopAddress(shop: ShopAddressParts): string {
  const seen = new Set<string>();
  return [
    shop.address,
    shop.street,
    shop.area,
    shop.landmark,
    shop.city,
    shop.state,
    shop.postalCode,
    shop.country,
  ]
    .flatMap((value) => (value ?? '').split(','))
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLocaleLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(', ');
}
