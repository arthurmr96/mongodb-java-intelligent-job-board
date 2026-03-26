import { useState, useRef } from 'react';

/**
 * PdfUploadZone
 *
 * A shared drag-and-drop PDF upload widget used by both the candidate and
 * recruiter flows.
 *
 * Features:
 * - Drag-and-drop or click-to-browse file selection
 * - File type validation (PDF only)
 * - A collapsible checklist of required PDF sections shown before upload
 * - Loading state while the backend parses the PDF
 * - Error display if parsing fails
 *
 * Props:
 *   onParsed         (profile: Object) => void   called with the pre-filled form data
 *   parseFunction    (file: File) => Promise      the API call to run (parseCvPdf or parseJobPdf)
 *   requiredSections string[]                     list of required PDF sections to show the user
 *   label            string                       title for the upload zone
 */
export default function PdfUploadZone({
  onParsed,
  parseFunction,
  requiredSections = [],
  label = 'Upload PDF',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await parseFunction(file);
      onParsed(result);
    } catch (err) {
      setError(err.message ?? 'PDF parsing failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-4">
      {/* Required sections checklist */}
      {requiredSections.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <button
            type="button"
            className="flex items-center gap-1 font-medium text-amber-800 w-full text-left"
            onClick={() => setShowChecklist((v) => !v)}
          >
            <span>{showChecklist ? '▾' : '▸'}</span>
            Required PDF sections for best extraction results
          </button>
          {showChecklist && (
            <ul className="mt-2 space-y-0.5 text-amber-700 list-inside list-disc pl-1">
              {requiredSections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2
          rounded-xl border-2 border-dashed p-8 cursor-pointer
          transition-colors select-none
          ${isDragging
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'}
          ${loading ? 'opacity-60 cursor-wait' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={loading}
        />

        {/* Icon */}
        <svg
          className="w-10 h-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>

        {loading ? (
          <p className="text-sm font-medium text-gray-600 animate-pulse">
            Parsing PDF with AI…
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-400">
              Drag and drop or click to browse · PDF only
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
