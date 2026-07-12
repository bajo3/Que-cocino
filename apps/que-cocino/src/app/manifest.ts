import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Qué Cocino", short_name: "Qué Cocino", description: "Recetas según tu inventario real", start_url: "/", display: "standalone", background_color: "#faf9f3", theme_color: "#3b7d4b", icons: [] }; }
