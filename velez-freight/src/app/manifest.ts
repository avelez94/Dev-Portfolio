import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { site } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.short,
    description: site.description,
    start_url: "/",
    display: "browser",
    background_color: "#F7F5F0",
    theme_color: "#142839",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/mlg-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
