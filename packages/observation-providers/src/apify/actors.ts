export const APIFY_ACTORS = {
  facebook: "KoJrdxJCTtpon81KY",
  instagram: "shu8hvrXbJbY3Eb9W",
  tiktok: "GdWCkxBtKWOsKjdch",
  facebook_ads: "XtaWFhbtfxyzqrFmd",
  google_maps: "8PLCMTY0L77LJQaaZ",
  google_search: "YNcgn7yiLc72ayYeB",
} as const;

export type ApifyActorProviderKey = keyof typeof APIFY_ACTORS;
