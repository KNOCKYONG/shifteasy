"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "image" | "text"; // default image; text available if explicitly requested
} & Partial<Omit<ComponentProps<typeof Image>, "src" | "alt" | "width" | "height">>;

export function BrandLogo({ href = "/", size = "md", className = "", variant = "image", ...imgProps }: BrandLogoProps) {
  const sizes = {
    sm: { w: 96, h: 24, class: "h-6 md:h-8" },
    md: { w: 216, h: 54, class: "h-12 md:h-[3.75rem]" },
    lg: { w: 192, h: 48, class: "h-10 md:h-12" },
  } as const;
  const s = sizes[size] ?? sizes.md;

  return (
    <Link href={href} aria-label="ShiftEasy Home" className={`inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded-md ${className}`}>
      {variant === "text" ? (
        <span className={`font-extrabold tracking-tight text-gray-900 dark:text-white ${s.class} flex items-center`} style={{ lineHeight: 1 }}>
          ShiftEasy
        </span>
      ) : (
        <Image
          src="/logo.png"
          alt="ShiftEasy"
          width={s.w}
          height={s.h}
          className={`w-auto ${s.class}`}
          priority
          {...imgProps}
        />
      )}
    </Link>
  );
}
