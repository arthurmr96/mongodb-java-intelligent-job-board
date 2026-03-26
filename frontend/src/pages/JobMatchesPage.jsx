import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MatchCard from '../components/MatchCard';
import MatchCardSkeleton from '../components/MatchCardSkeleton';
import { getJob, getMatchesForJob } from '../api/client';

export default function JobMatchesPage() {
  const { jobId } = useParams();

  const [job, setJob] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const skeletonCount = useMemo(() => 5, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [jobDoc, matchDocs] = await Promise.all([
          getJob(jobId),
          getMatchesForJob(jobId),
        ]);

        if (cancelled) return;
        setJob(jobDoc);
        setMatches(matchDocs);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load matches.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (jobId) load();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Top candidate matches</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ranked by AI semantic match + skill overlap for{' '}
            <strong>{loading ? '…' : (job?.title ?? '—')}</strong>
            {` `}at{' '}
            <strong>{loading ? '…' : (job?.company ?? '—')}</strong>
          </p>
        </div>

        <Link
          to="/recruiter"
          className="text-xs text-gray-400 hover:text-gray-600 w-fit"
        >
          ← New posting
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <MatchCardSkeleton key={i} variant="candidate" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No matching candidates found yet. Ask candidates to submit their profiles!
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((match, i) => (
            <MatchCard
              key={match.candidateId ?? i}
              name={match.candidateName}
              email={match.candidateEmail}
              compositeScore={match.compositeScore}
              vectorScore={match.vectorScore}
              skillScore={match.skillOverlapScore}
              matchedSkills={match.matchedSkills}
              missingSkills={match.missingSkills}
            />
          ))}
        </div>
      )}
    </div>
  );
}

