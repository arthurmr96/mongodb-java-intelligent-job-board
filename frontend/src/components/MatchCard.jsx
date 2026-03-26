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
 *   compositeScore number   0–1 weighted score
 *   vectorScore    number   raw vector similarity
 *   skillScore     number   fraction of required skills matched
 *   matchedSkills  string[] skills the candidate has
 *   missingSkills  string[] required skills the candidate lacks
 *
 * Props (job → candidate direction):
 *   name           string   candidate name
 *   email          string   candidate email
 *   + same score/skill fields
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
}) {
  const scorePercent = Math.round(compositeScore * 100);
  const barColor =
    scorePercent >= 75 ? 'bg-green-500' :
    scorePercent >= 50 ? 'bg-yellow-400' :
                         'bg-red-400';

  return (
    <div className="border border-gray-200 rounded-xl p-4 shadow-sm bg-white space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">
            {title ?? name ?? '—'}
          </h3>
          {(company || email) && (
            <p className="text-xs text-gray-500 mt-0.5">{company ?? email}</p>
          )}
        </div>

        {/* Composite score badge */}
        <span
          className={`shrink-0 text-sm font-bold px-2 py-0.5 rounded-full text-white ${barColor}`}
          title="Composite match score"
        >
          {scorePercent}%
        </span>
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
