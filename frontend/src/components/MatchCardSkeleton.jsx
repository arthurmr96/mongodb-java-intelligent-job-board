/**
 * MatchCardSkeleton
 *
 * Skeleton loader that mirrors MatchCard's layout to minimize layout shift.
 * Variants adjust the header lines (job vs candidate) to match each results page.
 */
export default function MatchCardSkeleton({ variant = 'job' } = {}) {
  const topLineWidth = variant === 'job' ? 'w-40 sm:w-56' : 'w-36 sm:w-52';
  const subLineWidth = variant === 'job' ? 'w-28 sm:w-40' : 'w-40 sm:w-56';

  return (
    <div className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white space-y-3 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">
            <span className={`inline-block h-4 ${topLineWidth} bg-gray-200 rounded`} />
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className={`inline-block h-3 ${subLineWidth} bg-gray-200 rounded`} />
          </p>
        </div>

        {/* Composite score badge */}
        <span className="shrink-0 h-6 w-12 rounded-full bg-gray-200" />
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-gray-200" />
      </div>

      {/* Score breakdown */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="inline-block h-3 w-24 bg-gray-200 rounded" />
        <span className="inline-block h-3 w-20 bg-gray-200 rounded" />
      </div>

      {/* Skill pills */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: variant === 'job' ? 6 : 5 }).map((_, i) => (
            <div key={i} className="h-5 w-16 rounded-full bg-gray-200" />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: variant === 'job' ? 3 : 4 }).map((_, i) => (
            <div key={i} className="h-5 w-14 rounded-full bg-gray-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

