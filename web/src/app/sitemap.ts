import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://www.sor7ed.com" },
    { url: "https://www.sor7ed.com/privacy-policy" },
    { url: "https://www.sor7ed.com/button-terms" },
  ];
}
