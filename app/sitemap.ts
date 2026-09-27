import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.cercanard.com";
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/preguntas-frecuentes`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/registro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${baseUrl}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
