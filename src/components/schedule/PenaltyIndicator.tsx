"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

interface PenaltyIndicatorProps {
  value: number;
  type?: "legal" | "preference" | "fairness" | "coverage" | "total";
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
  details?: {
    message: string;
    severity: "low" | "medium" | "high" | "critical";
  }[];
  className?: string;
}

export function PenaltyIndicator({
  value,
  type = "total",
  size = "md",
  showDetails = false,
  details = [],
  className = "",
}: PenaltyIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // 페널티 레벨 결정
  const getLevel = (): "safe" | "warning" | "danger" | "critical" => {
    if (value === 0) return "safe";
    if (value <= 10) return "warning";
    if (value <= 30) return "danger";
    return "critical";
  };

  const level = getLevel();

  // 색상 스타일
  const getColorClasses = () => {
    switch (level) {
      case "safe":
        return "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
      case "danger":
        return "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
      case "critical":
        return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
    }
  };

  // 아이콘 선택
  const getIcon = () => {
    const iconSize = size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5";

    switch (level) {
      case "safe":
        return <CheckCircle className={iconSize} />;
      case "warning":
        return <Info className={iconSize} />;
      case "danger":
        return <AlertCircle className={iconSize} />;
      case "critical":
        return <AlertTriangle className={iconSize} />;
    }
  };

  // 트렌드 아이콘
  const getTrendIcon = () => {
    const iconSize = size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5";

    if (value > 0) return <TrendingUp className={iconSize} />;
    if (value < 0) return <AlertCircle className={iconSize} />;
    return <CheckCircle className={iconSize} />;
  };

  // 사이즈별 패딩
  const getPadding = () => {
    switch (size) {
      case "sm":
        return "px-2 py-0.5";
      case "md":
        return "px-3 py-1";
      case "lg":
        return "px-4 py-2";
    }
  };

  // 텍스트 크기
  const getTextSize = () => {
    switch (size) {
      case "sm":
        return "text-xs";
      case "md":
        return "text-sm";
      case "lg":
        return "text-base";
    }
  };

  // 타입별 라벨
  const getTypeLabel = () => {
    switch (type) {
      case "legal":
        return "법적";
      case "preference":
        return "선호";
      case "fairness":
        return "공정";
      case "coverage":
        return "충원";
      default:
        return "총";
    }
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={`
          inline-flex items-center gap-1.5 rounded-lg border
          ${getColorClasses()}
          ${getPadding()}
          ${getTextSize()}
          font-medium
          transition-all
          ${showDetails ? "cursor-pointer hover:shadow-md" : ""}
        `}
        onMouseEnter={() => showDetails && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {getIcon()}
        <span>{getTypeLabel()}</span>
        <span className="font-bold">
          {value > 0 ? "+" : ""}{value}
        </span>
        {showDetails && <ChevronRight className="w-3 h-3 opacity-50" />}
      </div>

      {/* 툴팁 */}
      {showTooltip && showDetails && details.length > 0 && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-72">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              페널티 상세
            </div>
            <div className="space-y-2">
              {details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  {detail.severity === "critical" && (
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                  )}
                  {detail.severity === "high" && (
                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                  )}
                  {detail.severity === "medium" && (
                    <Info className="w-4 h-4 text-yellow-500 mt-0.5" />
                  )}
                  {detail.severity === "low" && (
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  )}
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {detail.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 페널티 배지 (간단한 버전)
export function PenaltyBadge({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  if (value === 0) return null;

  const getColorClasses = () => {
    if (value <= 10) return "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300";
    if (value <= 30) return "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300";
    return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-w-[20px] h-5 px-1
        text-xs font-bold
        rounded-full
        ${getColorClasses()}
        ${className}
      `}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}

// 페널티 변화 표시
export function PenaltyDelta({
  original,
  current,
  showPercentage = false,
  className = "",
}: {
  original: number;
  current: number;
  showPercentage?: boolean;
  className?: string;
}) {
  const delta = current - original;
  const percentage = original > 0 ? Math.round((delta / original) * 100) : 0;

  if (delta === 0) {
    return (
      <span className={`text-gray-500 dark:text-gray-400 text-sm ${className}`}>
        변화 없음
      </span>
    );
  }

  const isIncrease = delta > 0;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {isIncrease ? (
        <TrendingUp className="w-4 h-4 text-red-500" />
      ) : (
        <AlertCircle className="w-4 h-4 text-green-500" />
      )}
      <span
        className={`text-sm font-medium ${
          isIncrease ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
        }`}
      >
        {isIncrease ? "+" : ""}{delta}
        {showPercentage && percentage !== 0 && (
          <span className="text-xs opacity-75 ml-1">
            ({isIncrease ? "+" : ""}{percentage}%)
          </span>
        )}
      </span>
    </div>
  );
}