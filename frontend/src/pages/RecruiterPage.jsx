import { useState } from 'react';
import PdfUploadZone from '../components/PdfUploadZone';
import JobReviewForm from '../components/JobReviewForm';
import MatchCard from '../components/MatchCard';
import { parseJobPdf, saveJob, getMatchesForJob } from '../api/client';

/**
 * RecruiterPage
 *
 * Full recruiter flow:
 *   1. Upload job posting PDF → AI extracts structured posting → review form pre-filled
 *   2. Recruiter reviews and edits → clicks "Confirm & Publish"
 *   3. Backend embeds the posting and saves to MongoDB with status "published"
 *   4. Top candidate matches are fetched and displayed as ranked MatchCards
 *
 * The recruiter can also skip PDF upload and fill the form manually.
 */

const JOB_REQUIRED_SECTIONS = [
  'Job Title',
  'Company Name',
  'Location / Remote Policy',
  'Role Summary / About the Role',
  'Responsibilities (bulleted list)',
  'Required Skills (with minimum years if stated)',
  'Nice-to-Have Skills (optional)',
  'Seniority Level',
  'Employment Type',
  'Salary Range (optional)',
];

const STEP = { UPLOAD: 'upload', REVIEW: 'review', MATCHES: 'matches' };

export default function RecruiterPage() {
  const [step, setStep] = useState(STEP.UPLOAD);
  const [extractedJob, setExtractedJob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedJob, setSavedJob] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchError, setMatchError] = useState(null);

  function handlePdfParsed(posting) {
    setExtractedJob(posting);
    setStep(STEP.REVIEW);
  }

  function handleSkipUpload() {
    setExtractedJob({});
    setStep(STEP.REVIEW);
  }

  async function handleConfirm(formData) {
    setSaving(true);
    setMatchError(null);
    try {
      const job = await saveJob(formData);
      setSavedJob(job);

      const results = await getMatchesForJob(job.id);
      setMatches(results);
      setStep(STEP.MATCHES);
    } catch (err) {
      setMatchError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStep(STEP.UPLOAD);
    setExtractedJob(null);
    setSavedJob(null);
    setMatches([]);
    setMatchError(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recruiter Portal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a job posting PDF and let AI find your best-fit candidates.
        </p>
      </div>

      {/* Step indicator */}
      <StepBar current={step} />

      {/* ── Step 1: Upload ── */}
      {step === STEP.UPLOAD && (
        <div className="space-y-4">
          <PdfUploadZone
            label="Upload job posting PDF"
            parseFunction={parseJobPdf}
            requiredSections={JOB_REQUIRED_SECTIONS}
            onParsed={handlePdfParsed}
          />
          <div className="text-center">
            <button
              type="button"
              onClick={handleSkipUpload}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Skip upload — fill the form manually
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review form ── */}
      {step === STEP.REVIEW && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Review job posting</h2>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Start over
            </button>
          </div>

          {extractedJob && Object.keys(extractedJob).length > 1 && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
              The job posting was parsed successfully. Review the fields and correct anything before publishing.
            </div>
          )}

          {matchError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {matchError}
            </div>
          )}

          <JobReviewForm
            initialData={extractedJob ?? {}}
            onConfirm={handleConfirm}
            loading={saving}
          />
        </div>
      )}

      {/* ── Step 3: Match results ── */}
      {step === STEP.MATCHES && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Top candidate matches
              </h2>
              <p className="text-sm text-gray-500">
                Ranked by AI semantic match + skill overlap for{' '}
                <strong>{savedJob?.title}</strong> at{' '}
                <strong>{savedJob?.company}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← New posting
            </button>
          </div>

          {matches.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No matching candidates found yet. Ask candidates to submit their profiles!
            </p>
          ) : (
            <div className="space-y-3">
              {matches.map((match, i) => (
                <MatchCard
                  key={i}
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
      )}
    </div>
  );
}

function StepBar({ current }) {
  const steps = [
    { key: STEP.UPLOAD,  label: 'Upload PDF' },
    { key: STEP.REVIEW,  label: 'Review' },
    { key: STEP.MATCHES, label: 'Matches' },
  ];

  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done    = i < currentIndex;
        const active  = i === currentIndex;
        const pending = i > currentIndex;

        return (
          <li key={step.key} className="flex items-center flex-1 last:flex-none">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0
                ${done   ? 'bg-green-600 text-white' : ''}
                ${active ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : ''}
                ${pending? 'bg-gray-100 text-gray-400' : ''}
              `}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={`ml-1.5 text-xs font-medium hidden sm:block
                ${active ? 'text-green-700' : 'text-gray-400'}`}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
