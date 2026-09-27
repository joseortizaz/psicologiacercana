import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/super-admin", "/org-admin", "/set-password", "/auth/"],
      },
    ],
    sitemap: "https://www.cercanard.com/sitemap.xml",
  };
}
