import Image from "next/image";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Brand mark.
 *
 * `public/logo.svg` is a placeholder. To use the official UB Lunabotics logo,
 * replace that file (or drop in a PNG and update LOGO_SRC). The logo is assumed
 * to be dark-on-light, so on the navy sidebar it is shown on a white tile.
 */
const LOGO_SRC = "/logo.svg";

export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={LOGO_SRC}
      alt={`${APP_NAME} logo`}
      width={size}
      height={size}
      unoptimized
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/** Logo on a white rounded tile, for dark backgrounds. */
export function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-white"
      style={{ width: size, height: size }}
    >
      <Logo size={Math.round(size * 0.72)} />
    </span>
  );
}
