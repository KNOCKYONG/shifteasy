"use client";

import type { ReactNode } from "react";

type AppSurfaceProps = {
  children: ReactNode;
  withGlow?: boolean;
  className?: string;
};

export function AppSurface({ children, withGlow = true, className = "" }: AppSurfaceProps) {
  return (
    <div className={`relative min-h-screen bg-white dark:bg-[#0F172A] ${className}`}>
      {withGlow && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Remove gradients: keep only subtle blurred solids */}
          <div className="absolute -top-[20%] -right-[10%] w-[560px] h-[560px] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] -left-[10%] w-[480px] h-[480px] bg-blue-600/10 rounded-full blur-[120px]" />
        </div>
      )}
      {children}
    </div>
  );
}
