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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[720px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
          <div className="absolute -top-[20%] -right-[10%] w-[560px] h-[560px] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] -left-[10%] w-[480px] h-[480px] bg-blue-600/10 rounded-full blur-[120px]" />
        </div>
      )}
      {children}
    </div>
  );
}

