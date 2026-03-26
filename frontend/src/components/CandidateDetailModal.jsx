import { useEffect, useState } from 'react';
import Modal from './Modal';
import SkillBadge from './SkillBadge';
import { getCandidate } from '../api/client';

// ── LGPD / GDPR privacy helpers ───────────────────────────────────────────────
/**
 * Masks a full name to "First L." format.
 * e.g. "Arthur Müller Rodrigues" → "Arthur M."
 */
function maskName(fullName) {
  if (!fullName) return '—';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

/**
 * Masks an email address, keeping only the first character and domain.
 * e.g. "arthur@example.com" → "a***@example.com"
 */
function maskEmail(email) {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return `${local[0]}***`;
  return `${local[0]}***@${domain}`;
}

/**
 * Masks a phone number, showing only the last 4 digits.
 * e.g. "+55 11 98765-4321" → "•••• 4321"
 */
function maskPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}

/**
 * Trims location to city/state only (removes street-level detail).
 * Most locations in the system are already at city level, but this
 * guards against detailed addresses being stored.
 * e.g. "Rua das Flores 123, São Paulo, SP" → "São Paulo, SP"
 */
function coarsenLocation(location) {
  if (!location) return null;
  // If it looks like it has more than 2 comma-segments, keep only last 2
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 2) return parts.slice(-2).join(', ');
  return location;
}

// ── Score summary (same as JobDetailModal) ────────────────────────────────────
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
      <div className="rounded-lg bg-amber-50 h-10 w-full" />
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`h-3 bg-gray-100 rounded ${i % 2 ? 'w-3/4' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

// ── Privacy notice banner ─────────────────────────────────────────────────────
function PrivacyBanner() {
  return (
    <div className="flex gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <span className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true">🔒</span>
      <p className="text-xs text-amber-800 leading-relaxed">
        <strong>LGPD / GDPR notice:</strong> Personal contact information is masked in
        compliance with data protection regulations. Only professional details relevant
        to this match are displayed. Contact data is available only after mutual consent
        is established outside this platform.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
/**
 * CandidateDetailModal
 *
 * Opens when a recruiter clicks a candidate match card.
 * Fetches the full candidate document and renders it read-only with
 * LGPD/GDPR-compliant data masking applied to PII fields.
 *
 * Masking applied:
 *   name     → first name + last initial only   (Arthur M.)
 *   email    → first char + *** + @domain        (a***@gmail.com)
 *   phone    → last 4 digits only               (•••• 4321)
 *   location → city/state only, no street       (São Paulo, SP)
 *
 * Props:
 *   match   object | null   The match record from /match/job/:id
 *                           Must include: candidateId, candidateName,
 *                           compositeScore, vectorScore, skillOverlapScore,
 *                           matchedSkills[], missingSkills[]
 *   onClose fn              Called to dismiss the modal
 */
export default function CandidateDetailModal({ match, onClose }) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    if (!match?.candidateId) { setCandidate(null); return; }

    let cancelled = false;
    setCandidate(null);
    setError(null);
    setLoading(true);

    getCandidate(match.candidateId)
      .then((data) => { if (!cancelled) setCandidate(data); })
      .catch((e)   => { if (!cancelled) setError(e?.message ?? 'Failed to load candidate details.'); })
      .finally(()  => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [match?.candidateId]);

  // Apply masking to the loaded candidate
  const safe = candidate ? {
    name:     maskName(candidate.name),
    email:    maskEmail(candidate.email),
    phone:    maskPhone(candidate.phone),
    location: coarsenLocation(candidate.location),
    summary:  candidate.summary,
    skills:   candidate.skills ?? [],
    experience: candidate.experience ?? [],
    education:  candidate.education ?? [],
    certifications: candidate.certifications ?? [],
  } : null;

  const modalTitle = match
    ? `Candidate · ${maskName(match.candidateName)}`
    : '';

  return (
    <Modal open={!!match} onClose={onClose} title={modalTitle}>
      {/* Score header */}
      {match && <div className="mb-4"><ScoreSummary match={match} /></div>}

      {/* Privacy notice — always visible when modal is open */}
      {match && <div className="mb-6"><PrivacyBanner /></div>}

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {safe && (
        <div className="space-y-6">

          {/* ── Identity (masked) ─────────────────────────────────────────── */}
          <div>
            <h3 className="section-label">Candidate</h3>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <InfoRow label="Name"  value={safe.name} />
              <InfoRow label="Email" value={safe.email} masked />
              {safe.phone    && <InfoRow label="Phone"    value={safe.phone}    masked />}
              {safe.location && <InfoRow label="Location" value={safe.location} />}
            </div>
          </div>

          {/* ── Summary ──────────────────────────────────────────────────── */}
          {safe.summary && (
            <div>
              <h3 className="section-label">Professional Summary</h3>
              <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {safe.summary}
              </p>
            </div>
          )}

          {/* ── Skills ───────────────────────────────────────────────────── */}
          {safe.skills.length > 0 && (
            <div>
              <h3 className="section-label">Skills</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {safe.skills.map((s, i) => {
                  const isMatched = match?.matchedSkills?.includes(s.name);
                  const isMissing = match?.missingSkills?.includes(s.name);
                  return (
                    <SkillBadge
                      key={i}
                      name={s.name}
                      area={s.area}
                      years={s.years}
                      status={isMatched ? 'matched' : isMissing ? 'missing' : 'default'}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />matches your requirements
                <span className="inline-block w-2 h-2 rounded-full bg-red-400 ml-3 mr-1" />skill gap
              </p>
            </div>
          )}

          {/* ── Experience ───────────────────────────────────────────────── */}
          {safe.experience.length > 0 && (
            <div>
              <h3 className="section-label">Experience</h3>
              <div className="mt-2 space-y-3">
                {safe.experience.map((exp, i) => (
                  <div key={i} className="border-l-2 border-gray-200 pl-3">
                    <p className="text-sm font-medium text-gray-800">
                      {exp.title ?? exp.role ?? '—'}
                    </p>
                    {exp.company && (
                      <p className="text-xs text-gray-500">{exp.company}</p>
                    )}
                    {(exp.startDate || exp.endDate) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[exp.startDate, exp.endDate ?? 'Present'].join(' – ')}
                      </p>
                    )}
                    {exp.description && (
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Education ────────────────────────────────────────────────── */}
          {safe.education.length > 0 && (
            <div>
              <h3 className="section-label">Education</h3>
              <div className="mt-2 space-y-2">
                {safe.education.map((edu, i) => (
                  <div key={i} className="border-l-2 border-gray-200 pl-3">
                    <p className="text-sm font-medium text-gray-800">
                      {edu.degree ?? edu.title ?? '—'}
                    </p>
                    {edu.institution && (
                      <p className="text-xs text-gray-500">{edu.institution}</p>
                    )}
                    {(edu.startYear || edu.endYear) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[edu.startYear, edu.endYear ?? 'Present'].filter(Boolean).join(' – ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Certifications ───────────────────────────────────────────── */}
          {safe.certifications.length > 0 && (
            <div>
              <h3 className="section-label">Certifications</h3>
              <ul className="mt-2 space-y-1">
                {safe.certifications.map((cert, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    🏅 {typeof cert === 'string' ? cert : cert.name ?? JSON.stringify(cert)}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </Modal>
  );
}

// ── Small helper components ───────────────────────────────────────────────────
function InfoRow({ label, value, masked = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${masked ? 'text-gray-500 font-mono' : 'text-gray-800'}`}>
        {value}
        {masked && (
          <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-sans font-medium align-middle">
            masked
          </span>
        )}
      </span>
    </div>
  );
}
