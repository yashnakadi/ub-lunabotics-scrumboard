import Image from "next/image";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Official UB Lunabotics badge (`public/logo.svg`).
 *
 * The SVG is square and its viewBox is trimmed to the badge edge, so it can be
 * rendered at any square size with `object-contain` and nothing is cropped or
 * stretched. Being a vector, it stays sharp on high-DPI screens.
 */
const LOGO_SRC = "/logo.svg";

interface LogoProps {
  /** Rendered width and height in CSS pixels. */
  size?: number;
  className?: string;
  /** Set when the logo sits next to visible text that already names the team. */
  decorative?: boolean;
}

export function Logo({ size = 40, className, decorative = false }: LogoProps) {
  return (
    <Image
      src={LOGO_SRC}
      alt={decorative ? "" : `${APP_NAME} logo`}
      width={size}
      height={size}
      unoptimized
      priority
      className={cn("aspect-square shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
