/**
 * SkillBadge
 *
 * A small chip that displays a skill name with an optional years / proficiency
 * annotation. The colour communicates match status:
 *
 *   matched  → green  (candidate has this skill; job requires it)
 *   missing  → red    (job requires this skill; candidate lacks it)
 *   preferred→ blue   (nice-to-have; candidate may or may not have it)
 *   default  → grey   (neutral display, e.g. candidate profile page)
 *
 * @param {{ name: string, years?: number, area?: string, status?: 'matched'|'missing'|'preferred'|'default' }} props
 */
export default function SkillBadge({ name, years, area, status = 'default' }) {
  const colorMap = {
    matched:   'bg-green-100 text-green-800 border border-green-300',
    missing:   'bg-red-100 text-red-800 border border-red-300',
    preferred: 'bg-blue-100 text-blue-800 border border-blue-300',
    default:   'bg-gray-100 text-gray-700 border border-gray-200',
  };

  const classes = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
    ${colorMap[status] ?? colorMap.default}`;

  return (
    <span className={classes} title={area ? `Area: ${area}` : undefined}>
      {name}
      {years != null && (
        <span className="opacity-70 font-normal">{years}yr</span>
      )}
    </span>
  );
}
