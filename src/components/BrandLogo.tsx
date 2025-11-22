"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
} & Omit<ComponentProps<typeof Image>, "src" | "alt" | "width" | "height">;

export function BrandLogo({ href = "/", size = "md", className = "", ...imgProps }: BrandLogoProps) {
  const sizes = {
    sm: { w: 96, h: 24, class: "h-6 md:h-8" },
    md: { w: 144, h: 36, class: "h-8 md:h-10" },
    lg: { w: 192, h: 48, class: "h-10 md:h-12" },
  } as const;

  const s = sizes[size] ?? sizes.md;

  return (
    <Link href={href} aria-label="ShiftEasy Home" className={`inline-flex items-center ${className}`}>
      <Image
        src="/logo.png"
        alt="ShiftEasy"
        width={s.w}
        height={s.h}
        className={`w-auto ${s.class}`}
        priority
        {...imgProps}
      />
    </Link>
  );
}

