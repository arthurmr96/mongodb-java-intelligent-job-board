import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MatchCard from '../components/MatchCard';
import MatchCardSkeleton from '../components/MatchCardSkeleton';
import { getCandidate, getMatchesForCandidate } from '../api/client';

export default function CandidateMatchesPage() {
  const { candidateId } = useParams();

  const [candidate, setCandidate] = useState(null);
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
        const [candidateDoc, matchDocs] = await Promise.all([
          getCandidate(candidateId),
          getMatchesForCandidate(candidateId),
        ]);

        if (cancelled) return;
        setCandidate(candidateDoc);
        setMatches(matchDocs);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load matches.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (candidateId) load();

    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Your top job matches</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ranked by AI semantic match + skill overlap for{' '}
            <strong>{loading ? '…' : (candidate?.name ?? '—')}</strong>
          </p>
        </div>

        <Link
          to="/candidate"
          className="text-xs text-gray-400 hover:text-gray-600 w-fit"
        >
          ← New profile
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
            <MatchCardSkeleton key={i} variant="job" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No matching jobs found yet. Ask a recruiter to publish job postings!
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((match, i) => (
            <MatchCard
              key={match.jobId ?? i}
              title={match.jobTitle}
              company={match.company}
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

