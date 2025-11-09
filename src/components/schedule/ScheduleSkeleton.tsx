export function ScheduleSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="grid grid-cols-8 gap-px bg-gray-200 dark:bg-gray-700">
          {/* Header row */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-12 bg-white dark:bg-gray-800"></div>
          ))}
          {/* Data rows */}
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            Array.from({ length: 8 }).map((_, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="h-16 bg-white dark:bg-gray-800"
              >
                <div className="p-2">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            ))
          ))}
        </div>
      </div>
    </div>
  );
}
