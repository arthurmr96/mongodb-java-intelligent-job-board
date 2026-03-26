import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PdfUploadZone from '../components/PdfUploadZone';
import CandidateReviewForm from '../components/CandidateReviewForm';
import { parseCvPdf, saveCandidate } from '../api/client';

/**
 * CandidatePage
 *
 * Full candidate flow:
 *   1. Upload CV PDF → AI extracts structured profile → review form pre-filled
 *   2. User reviews and edits → clicks "Confirm & Submit"
 *   3. Backend embeds the profile and saves to MongoDB
 *   4. Top job matches are fetched and displayed as ranked MatchCards
 *
 * The user can also skip PDF upload and fill the form manually (empty initial state).
 */

const CV_REQUIRED_SECTIONS = [
  'Personal Information (name, email, phone, location)',
  'Professional Summary / About',
  'Skills (with proficiency level)',
  'Work Experience (company, role, dates, description)',
  'Education (degree, institution, year)',
  'Certifications (optional)',
];

// Step identifiers
const STEP = { UPLOAD: 'upload', REVIEW: 'review' };

export default function CandidatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP.UPLOAD);
  const [extractedProfile, setExtractedProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [matchError, setMatchError] = useState(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handlePdfParsed(profile) {
    setExtractedProfile(profile);
    setStep(STEP.REVIEW);
  }

  function handleSkipUpload() {
    setExtractedProfile({});
    setStep(STEP.REVIEW);
  }

  async function handleConfirm(formData) {
    setSaving(true);
    setMatchError(null);
    try {
      const candidate = await saveCandidate(formData);
      navigate(`/candidate/${candidate.id}/matches`);
    } catch (err) {
      setMatchError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStep(STEP.UPLOAD);
    setExtractedProfile(null);
    setMatchError(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Candidate Portal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your CV PDF and let AI match you to the best job opportunities.
        </p>
      </div>

      {/* Step indicator */}
      <StepBar current={step} />

      {/* ── Step 1: Upload ── */}
      {step === STEP.UPLOAD && (
        <div className="space-y-4">
          <PdfUploadZone
            label="Upload your CV PDF"
            parseFunction={parseCvPdf}
            requiredSections={CV_REQUIRED_SECTIONS}
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
            <h2 className="text-lg font-semibold text-gray-800">Review your profile</h2>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ← Start over
            </button>
          </div>

          {extractedProfile && Object.keys(extractedProfile).length > 0 && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
              Your CV was parsed successfully. Review the fields below and correct anything that looks off.
            </div>
          )}

          {matchError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
              {matchError}
            </div>
          )}

          <CandidateReviewForm
            initialData={extractedProfile ?? {}}
            onConfirm={handleConfirm}
            loading={saving}
          />
        </div>
      )}

    </div>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────

function StepBar({ current }) {
  const steps = [
    { key: STEP.UPLOAD,  label: 'Upload CV' },
    { key: STEP.REVIEW,  label: 'Review' },
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
