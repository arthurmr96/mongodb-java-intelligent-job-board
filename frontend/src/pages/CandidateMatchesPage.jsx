import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MatchCard from '../components/MatchCard';
import MatchCardSkeleton from '../components/MatchCardSkeleton';
import JobDetailModal from '../components/JobDetailModal';
import { getCandidate, getMatchesForCandidate } from '../api/client';

const PAGE_SIZE = 10;

export default function CandidateMatchesPage() {
  const { candidateId } = useParams();

  const [candidate, setCandidate] = useState(null);
  const [matches, setMatches] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const skeletonCount = useMemo(() => 5, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [candidateDoc, matchPage] = await Promise.all([
          getCandidate(candidateId),
          getMatchesForCandidate(candidateId, { limit: PAGE_SIZE }),
        ]);

        if (cancelled) return;
        setCandidate(candidateDoc);
        setMatches(matchPage.items);
        setNextCursor(matchPage.nextCursor);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load matches.');
        setMatches([]);
        setNextCursor(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (candidateId) load();

    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  async function handleLoadMore() {
    if (!candidateId || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const matchPage = await getMatchesForCandidate(candidateId, {
        limit: PAGE_SIZE,
        afterScore: nextCursor.afterScore,
        afterId: nextCursor.afterId,
      });

      setMatches((current) => {
        const seen = new Set(current.map((match) => match.id));
        const appended = matchPage.items.filter((match) => !seen.has(match.id));
        return [...current, ...appended];
      });
      setNextCursor(matchPage.nextCursor);
    } catch (e) {
      setError(e?.message ?? 'Failed to load more matches.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {loading ? (
              <span className="inline-block h-7 w-56 sm:w-72 bg-gray-200 rounded animate-pulse align-middle" />
            ) : (
              'Your top job matches'
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? (
              <span className="inline-block h-4 w-72 sm:w-[28rem] bg-gray-200 rounded animate-pulse align-middle" />
            ) : (
              <>
                Ranked by AI semantic match + skill overlap for{' '}
                <strong>{candidate?.name ?? '—'}</strong>
              </>
            )}
          </p>
        </div>

        <Link
          to="/candidate"
          className={`text-xs w-fit ${
            loading
              ? 'text-transparent pointer-events-none select-none'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {loading ? (
            <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse align-middle" />
          ) : (
            '← New profile'
          )}
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
              key={match.id ?? match.jobId ?? i}
              title={match.jobTitle}
              company={match.company}
              compositeScore={match.compositeScore}
              vectorScore={match.vectorScore}
              skillScore={match.skillOverlapScore}
              matchedSkills={match.matchedSkills}
              missingSkills={match.missingSkills}
              onClick={() => setSelectedMatch(match)}
            />
          ))}

          {nextCursor && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
            >
              {loadingMore ? 'Loading more matches...' : 'Load more'}
            </button>
          )}
        </div>
      )}

      <JobDetailModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}
