// Catalogue snapshot from ttt170689-afk/fantazia-shop/server.js, 2026-10-14.
// Display only. A payment backend must resolve its own trusted price by pack ID.
export const SHOP_PACKS = [
  { id: "crystals-60", gems: 60, priceRub: 59 },
  { id: "crystals-150", gems: 150, priceRub: 139 },
  { id: "crystals-320", gems: 320, priceRub: 269 },
  { id: "crystals-700", gems: 700, priceRub: 549 },
  { id: "crystals-1500", gems: 1500, priceRub: 999 },
  { id: "crystals-3500", gems: 3500, priceRub: 1999 },
] as const;
// Supply a user-approved, licensed local audio asset later. No auto-play.
export const SHOP_MUSIC: { src: string; title: string } = { src: "", title: "" };
