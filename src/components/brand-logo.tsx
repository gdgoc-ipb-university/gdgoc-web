import Image from "next/image";

/** GDG on Campus IPB University lockup (transparent SVG from the GDGOC 26/27 Figma file). */
export function BrandLogo({ preload = false }: { preload?: boolean }) {
  return <Image src="/brand/gdgoc-ipb.svg" alt="Google Developer Group IPB University" width={375} height={50} preload={preload} unoptimized />;
}
