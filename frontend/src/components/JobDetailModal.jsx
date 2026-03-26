import { useEffect, useState } from 'react';
import Modal from './Modal';
import SkillBadge from './SkillBadge';
import { getJob } from '../api/client';

// ── Label maps ──────────────────────────────────────────────────────────────
const SENIORITY_LABEL = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
};

const REMOTE_LABEL = {
  remote: '🌍 Remote',
  hybrid: '🏢 Hybrid',
  'on-site': '📍 On-site',
};

const EMPLOYMENT_LABEL = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSalary({ min, max, currency } = {}) {
  if (!min && !max) return null;
  const fmt = (n) => n?.toLocaleString('en-US');
  if (min && max) return `${currency ?? 'USD'} ${fmt(min)} – ${fmt(max)} / year`;
  if (min) return `${currency ?? 'USD'} ${fmt(min)}+ / year`;
  return `Up to ${currency ?? 'USD'} ${fmt(max)} / year`;
}

function ScoreSummary({ match }) {
  const scorePercent = Math.round((match?.compositeScore ?? 0) * 100);
  const barColor =
    scorePercent >= 75 ? 'bg-green-500' :
    scorePercent >= 50 ? 'bg-yellow-400' :
                         'bg-red-400';
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Match Score</span>
        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full text-white ${barColor}`}>
          {scorePercent}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${scorePercent}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs text-gray-500 pt-0.5">
        <span>Semantic: <strong>{Math.round((match?.vectorScore ?? 0) * 100)}%</strong></span>
        <span>Skills: <strong>{Math.round((match?.skillOverlapScore ?? 0) * 100)}%</strong></span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl bg-gray-100 h-24 w-full" />
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="flex gap-2">
        <div className="h-7 bg-gray-200 rounded-full w-20" />
        <div className="h-7 bg-gray-200 rounded-full w-24" />
        <div className="h-7 bg-gray-200 rounded-full w-20" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-1/4 mt-4" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`h-3 bg-gray-100 rounded ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
/**
 * JobDetailModal
 *
 * Opens when a candidate clicks a job match card.
 * Fetches the full job document and renders it read-only alongside
 * the match score breakdown.
 *
 * Props:
 *   match   object | null   The match record from /match/candidate/:id
 *                           Must include: jobId, jobTitle, company,
 *                           compositeScore, vectorScore, skillOverlapScore,
 *                           matchedSkills[], missingSkills[]
 *   onClose fn              Called to dismiss the modal
 */
export default function JobDetailModal({ match, onClose }) {
  const [job, setJob]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!match?.jobId) { setJob(null); return; }

    let cancelled = false;
    setJob(null);
    setError(null);
    setLoading(true);

    getJob(match.jobId)
      .then((data) => { if (!cancelled) setJob(data); })
      .catch((e)   => { if (!cancelled) setError(e?.message ?? 'Failed to load job details.'); })
      .finally(()  => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [match?.jobId]);

  const modalTitle = match
    ? [match.jobTitle, match.company].filter(Boolean).join(' · ')
    : '';

  return (
    <Modal open={!!match} onClose={onClose} title={modalTitle}>
      {/* Always show score header if match is present */}
      {match && <div className="mb-6"><ScoreSummary match={match} /></div>}

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {job && (
        <div className="space-y-6">

          {/* ── Meta tags ─────────────────────────────────────────────────── */}
          <div>
            <h3 className="section-label">Position Details</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {job.seniority && (
                <Tag color="blue">
                  {SENIORITY_LABEL[job.seniority] ?? job.seniority}
                </Tag>
              )}
              {job.remotePolicy && (
                <Tag color="purple">
                  {REMOTE_LABEL[job.remotePolicy] ?? job.remotePolicy}
                </Tag>
              )}
              {job.employmentType && (
                <Tag color="gray">
                  {EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType}
                </Tag>
              )}
              {job.location && (
                <Tag color="gray">📍 {job.location}</Tag>
              )}
            </div>
          </div>

          {/* ── Compensation ─────────────────────────────────────────────── */}
          {formatSalary(job.salary) && (
            <div>
              <h3 className="section-label">Compensation</h3>
              <p className="mt-1 text-sm font-semibold text-green-700">
                💰 {formatSalary(job.salary)}
              </p>
            </div>
          )}

          {/* ── About the role ───────────────────────────────────────────── */}
          {job.summary && (
            <div>
              <h3 className="section-label">About the Role</h3>
              <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {job.summary}
              </p>
            </div>
          )}

          {/* ── Responsibilities ─────────────────────────────────────────── */}
          {job.responsibilities?.length > 0 && (
            <div>
              <h3 className="section-label">Responsibilities</h3>
              <ul className="mt-2 space-y-1.5 list-disc list-inside">
                {job.responsibilities.map((r, i) => (
                  <li key={i} className="text-sm text-gray-700">{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Required Skills ──────────────────────────────────────────── */}
          {job.requiredSkills?.length > 0 && (
            <div>
              <h3 className="section-label">Required Skills</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.requiredSkills.map((s, i) => {
                  const matched = match?.matchedSkills?.includes(s.name);
                  const missing = match?.missingSkills?.includes(s.name);
                  return (
                    <SkillBadge
                      key={i}
                      name={s.name}
                      area={s.area}
                      years={s.minYears ? `${s.minYears}+` : undefined}
                      status={matched ? 'matched' : missing ? 'missing' : 'default'}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />you have it
                <span className="inline-block w-2 h-2 rounded-full bg-red-400 ml-3 mr-1" />you're missing it
              </p>
            </div>
          )}

          {/* ── Preferred Skills ─────────────────────────────────────────── */}
          {job.preferredSkills?.length > 0 && (
            <div>
              <h3 className="section-label">Preferred Skills</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.preferredSkills.map((s, i) => (
                  <SkillBadge key={i} name={s.name} area={s.area} status="preferred" />
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </Modal>
  );
}

// ── Small helper components ───────────────────────────────────────────────────
function Tag({ children, color = 'gray' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    gray:   'bg-gray-100 text-gray-600',
    green:  'bg-green-50 text-green-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
}
