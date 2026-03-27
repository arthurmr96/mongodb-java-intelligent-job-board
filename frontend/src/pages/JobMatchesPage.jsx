import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MatchCard from '../components/MatchCard';
import MatchCardSkeleton from '../components/MatchCardSkeleton';
import CandidateDetailModal from '../components/CandidateDetailModal';
import { getJob, getMatchesForJob } from '../api/client';

const PAGE_SIZE = 10;

export default function JobMatchesPage() {
  const { jobId } = useParams();

  const [job, setJob] = useState(null);
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
        const [jobDoc, matchPage] = await Promise.all([
          getJob(jobId),
          getMatchesForJob(jobId, { limit: PAGE_SIZE }),
        ]);

        if (cancelled) return;
        setJob(jobDoc);
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

    if (jobId) load();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function handleLoadMore() {
    if (!jobId || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const matchPage = await getMatchesForJob(jobId, {
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
              'Top candidate matches'
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? (
              <span className="inline-block h-4 w-80 sm:w-[30rem] bg-gray-200 rounded animate-pulse align-middle" />
            ) : (
              <>
                Ranked by AI semantic match + skill overlap for{' '}
                <strong>{job?.title ?? '—'}</strong>
                {` `}at{' '}
                <strong>{job?.company ?? '—'}</strong>
              </>
            )}
          </p>
        </div>

        <Link
          to="/recruiter"
          className={`text-xs w-fit ${
            loading
              ? 'text-transparent pointer-events-none select-none'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {loading ? (
            <span className="inline-block h-4 w-24 bg-gray-200 rounded animate-pulse align-middle" />
          ) : (
            '← New posting'
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
              key={match.id ?? match.candidateId ?? i}
              name={match.candidateName}
              email={match.candidateEmail}
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

      <CandidateDetailModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />
    </div>
  );
}
