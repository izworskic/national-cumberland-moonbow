import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Cumberland Falls Moonbow Window", short_name: "Moonbow Window", description: "Live decision support for Cumberland Falls moonbow viewing.", start_url: "/cumberland-falls-moonbow", display: "standalone", background_color: "#071315", theme_color: "#071315", icons: [] }; }
