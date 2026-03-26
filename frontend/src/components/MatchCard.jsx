import SkillBadge from './SkillBadge';

/**
 * MatchCard
 *
 * Displays a single match result from the `/match/candidate/:id` or
 * `/match/job/:id` endpoint.
 *
 * Props (candidate → job direction):
 *   title          string   job title
 *   company        string   company name
 *
 * Props (job → candidate direction):
 *   name           string   candidate name
 *   email          string   candidate email
 *
 * Common props:
 *   compositeScore number   0–1 weighted score
 *   vectorScore    number   raw vector similarity
 *   skillScore     number   fraction of required skills matched
 *   matchedSkills  string[] skills the candidate has
 *   missingSkills  string[] required skills the candidate lacks
 *   onClick        fn       optional — opens detail modal when provided
 */
export default function MatchCard({
  // Job fields (candidate → job view)
  title,
  company,
  // Candidate fields (job → candidate view)
  name,
  email,
  // Scores
  compositeScore = 0,
  vectorScore = 0,
  skillScore = 0,
  // Skill breakdown
  matchedSkills = [],
  missingSkills = [],
  // Interaction
  onClick,
}) {
  const scorePercent = Math.round(compositeScore * 100);
  const barColor =
    scorePercent >= 75 ? 'bg-green-500' :
    scorePercent >= 50 ? 'bg-yellow-400' :
                         'bg-red-400';

  const isClickable = typeof onClick === 'function';

  return (
    <div
      className={`
        border border-gray-200 rounded-xl p-4 shadow-sm bg-white space-y-3
        transition-all duration-150
        ${isClickable
          ? 'cursor-pointer hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm'
          : ''}
      `}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable
        ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
        : undefined}
      aria-label={isClickable ? `View details for ${title ?? name}` : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
            {title ?? name ?? '—'}
          </h3>
          {(company || email) && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{company ?? email}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Composite score badge */}
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded-full text-white ${barColor}`}
            title="Composite match score"
          >
            {scorePercent}%
          </span>
          {/* Chevron hint when clickable */}
          {isClickable && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${scorePercent}%` }}
        />
      </div>

      {/* Score breakdown */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>Semantic: <strong>{Math.round(vectorScore * 100)}%</strong></span>
        <span>Skills: <strong>{Math.round(skillScore * 100)}%</strong></span>
      </div>

      {/* Matched skills */}
      {matchedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matchedSkills.map((skill) => (
            <SkillBadge key={skill} name={skill} status="matched" />
          ))}
        </div>
      )}

      {/* Missing skills */}
      {missingSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {missingSkills.map((skill) => (
            <SkillBadge key={skill} name={skill} status="missing" />
          ))}
        </div>
      )}
    </div>
  );
}
