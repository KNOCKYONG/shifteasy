import React from "react";
import Lottie from "lottie-react";
import clsx from "clsx";
import loadingAnimation from "@/../public/lottie/schedule-loading.json";

type LottieLoadingOverlayProps = {
  message?: string;
  compact?: boolean;
  fullScreen?: boolean;
  className?: string;
};

export function LottieLoadingOverlay({
  message,
  compact = false,
  fullScreen = false,
  className,
}: LottieLoadingOverlayProps) {
  const containerClass = clsx(
    "flex w-full flex-col items-center justify-center text-center",
    fullScreen ? "py-16 min-h-[50vh]" : compact ? "py-6" : "py-12",
    className
  );

  return (
    <div className={containerClass}>
      <div className={compact ? "h-20 w-20" : "h-32 w-32"}>
        <Lottie animationData={loadingAnimation} loop autoplay />
      </div>
      {message ? (
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
          {message}
        </p>
      ) : null}
    </div>
  );
}
