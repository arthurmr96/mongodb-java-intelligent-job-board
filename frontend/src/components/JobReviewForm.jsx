import { useState } from 'react';

const SENIORITY_OPTIONS = ['junior', 'mid', 'senior', 'lead', 'principal'];
const REMOTE_OPTIONS    = ['remote', 'hybrid', 'on-site'];
const EMPLOYMENT_TYPES  = ['full-time', 'part-time', 'contract'];

/**
 * JobReviewForm
 *
 * An editable form pre-filled with job posting data extracted from a PDF.
 * The recruiter reviews and corrects any fields before confirming publication.
 *
 * Props:
 *   initialData  Object          the JobPosting returned by parseJobPdf
 *   onConfirm    (data) => void  called with the final form data on confirmation
 *   loading      boolean         true while saveJob is in flight
 */
export default function JobReviewForm({ initialData = {}, onConfirm, loading = false }) {
  const [form, setForm] = useState({
    title:          initialData.title ?? '',
    company:        initialData.company ?? '',
    location:       initialData.location ?? '',
    remotePolicy:   initialData.remotePolicy ?? 'hybrid',
    seniority:      initialData.seniority ?? 'mid',
    employmentType: initialData.employmentType ?? 'full-time',
    salary:         initialData.salary ?? { min: null, max: null, currency: 'USD' },
    summary:        initialData.summary ?? '',
    responsibilities: (initialData.responsibilities ?? []).join('\n'),
    requiredSkills: initialData.requiredSkills ?? [],
    preferredSkills:initialData.preferredSkills ?? [],
    source:         initialData.source ?? 'manual',
  });

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Required skills helpers
  function updateReqSkill(index, key, value) {
    const skills = [...form.requiredSkills];
    skills[index] = { ...skills[index], [key]: value };
    setField('requiredSkills', skills);
  }

  function addReqSkill() {
    setField('requiredSkills', [...form.requiredSkills, { name: '', area: '', minYears: null }]);
  }

  function removeReqSkill(index) {
    setField('requiredSkills', form.requiredSkills.filter((_, i) => i !== index));
  }

  // Validation
  const missingRequired = [];
  if (!form.title.trim())   missingRequired.push('Job title');
  if (!form.summary.trim()) missingRequired.push('Role summary');
  if (form.requiredSkills.length === 0) missingRequired.push('At least one required skill');

  // Build the payload for submission (convert responsibilities string back to array)
  function buildPayload() {
    return {
      ...form,
      responsibilities: form.responsibilities
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  return (
    <div className="space-y-6">
      {missingRequired.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Missing required fields:</strong> {missingRequired.join(', ')}.
        </div>
      )}

      {/* Job details */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Job Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Job Title *', key: 'title' },
            { label: 'Company', key: 'company' },
            { label: 'Location', key: 'location' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm
                           focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
              />
            </div>
          ))}

          {/* Remote policy */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Remote policy</label>
            <select
              value={form.remotePolicy}
              onChange={(e) => setField('remotePolicy', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         focus:border-green-500 outline-none bg-white"
            >
              {REMOTE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Seniority */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Seniority</label>
            <select
              value={form.seniority}
              onChange={(e) => setField('seniority', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         focus:border-green-500 outline-none bg-white"
            >
              {SENIORITY_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Employment type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employment type</label>
            <select
              value={form.employmentType}
              onChange={(e) => setField('employmentType', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         focus:border-green-500 outline-none bg-white"
            >
              {EMPLOYMENT_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Role Summary *
        </h3>
        <textarea
          value={form.summary}
          onChange={(e) => setField('summary', e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none resize-y"
          placeholder="Describe the role, team context, and what the ideal candidate will work on…"
        />
      </section>

      {/* Responsibilities */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Responsibilities
        </h3>
        <textarea
          value={form.responsibilities}
          onChange={(e) => setField('responsibilities', e.target.value)}
          rows={5}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none resize-y"
          placeholder="One responsibility per line…"
        />
        <p className="text-xs text-gray-400">
          One bullet point per line. These are included in the AI embedding alongside the summary.
        </p>
      </section>

      {/* Required skills */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Required Skills *
          </h3>
          <button
            type="button"
            onClick={addReqSkill}
            className="text-xs text-green-700 hover:text-green-900 font-medium"
          >
            + Add skill
          </button>
        </div>

        {form.requiredSkills.length === 0 && (
          <p className="text-sm text-gray-400 italic">No required skills extracted. Add them manually.</p>
        )}

        <div className="space-y-2">
          {form.requiredSkills.map((skill, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Skill name"
                value={skill.name ?? ''}
                onChange={(e) => updateReqSkill(i, 'name', e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 outline-none"
              />
              <input
                type="text"
                placeholder="Area"
                value={skill.area ?? ''}
                onChange={(e) => updateReqSkill(i, 'area', e.target.value)}
                className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 outline-none"
              />
              <input
                type="number"
                placeholder="Min yrs"
                value={skill.minYears ?? ''}
                min={0}
                max={30}
                onChange={(e) => updateReqSkill(i, 'minYears', e.target.value ? parseInt(e.target.value) : null)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 outline-none"
              />
              <button
                type="button"
                onClick={() => removeReqSkill(i)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
                aria-label="Remove skill"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Confirm */}
      <div className="pt-2">
        <button
          type="button"
          disabled={loading || missingRequired.length > 0}
          onClick={() => onConfirm(buildPayload())}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white
                     hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Publishing…' : 'Confirm & Publish Job'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          After publishing, the job will be embedded and saved, then you'll see your top candidate matches.
        </p>
      </div>
    </div>
  );
}
