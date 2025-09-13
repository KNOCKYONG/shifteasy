"use client";
import { useState, ReactNode } from "react";
import { HelpCircle, Info } from "lucide-react";

interface TooltipProps {
  content: string | ReactNode;
  children?: ReactNode;
  icon?: "help" | "info";
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({
  content,
  children,
  icon = "help",
  position = "top",
  className = ""
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2"
  };

  const arrowClasses = {
    top: "top-full left-1/2 transform -translate-x-1/2 border-t-gray-800 dark:border-t-slate-700",
    bottom: "bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-800 dark:border-b-slate-700",
    left: "left-full top-1/2 transform -translate-y-1/2 border-l-gray-800 dark:border-l-slate-700",
    right: "right-full top-1/2 transform -translate-y-1/2 border-r-gray-800 dark:border-r-slate-700"
  };

  const Icon = icon === "help" ? HelpCircle : Info;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
        className="inline-flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
      >
        {children || <Icon className="w-4 h-4" />}
      </button>

      {isVisible && (
        <div className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}>
          <div className="relative">
            <div className="bg-gray-800 dark:bg-slate-700 text-white text-xs rounded-lg p-3 max-w-xs shadow-lg">
              {content}
            </div>
            <div
              className={`absolute w-0 h-0 border-4 border-transparent ${arrowClasses[position]}`}
              style={{
                borderTopWidth: position === "bottom" ? "4px" : "0",
                borderBottomWidth: position === "top" ? "4px" : "0",
                borderLeftWidth: position === "right" ? "4px" : "0",
                borderRightWidth: position === "left" ? "4px" : "0"
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}