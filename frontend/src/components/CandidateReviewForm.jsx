import { useState } from 'react';
import SkillBadge from './SkillBadge';

/**
 * CandidateReviewForm
 *
 * An editable form pre-filled with the data extracted from a CV PDF.
 * The user reviews and corrects any fields before confirming submission.
 *
 * Props:
 *   initialData  Object        the CandidateProfile returned by parseCvPdf
 *   onConfirm    (data) => void  called with the final form data on confirmation
 *   loading      boolean       true while saveCandidate is in flight
 */
export default function CandidateReviewForm({ initialData = {}, onConfirm, loading = false }) {
  const [form, setForm] = useState({
    name:           initialData.name ?? '',
    email:          initialData.email ?? '',
    phone:          initialData.phone ?? '',
    location:       initialData.location ?? '',
    summary:        initialData.summary ?? '',
    skills:         initialData.skills ?? [],
    experience:     initialData.experience ?? [],
    education:      initialData.education ?? [],
    certifications: initialData.certifications ?? [],
    source:         initialData.source ?? 'manual',
  });

  // ── Field helpers ──────────────────────────────────────────────────────

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Skill array helpers
  function updateSkill(index, key, value) {
    const skills = [...form.skills];
    skills[index] = { ...skills[index], [key]: value };
    setField('skills', skills);
  }

  function addSkill() {
    setField('skills', [...form.skills, { name: '', area: '', years: null }]);
  }

  function removeSkill(index) {
    setField('skills', form.skills.filter((_, i) => i !== index));
  }

  // ── Validation ─────────────────────────────────────────────────────────

  const missingRequired = [];
  if (!form.name.trim())    missingRequired.push('Full name');
  if (!form.email.trim())   missingRequired.push('Email');
  if (!form.summary.trim()) missingRequired.push('Professional summary');
  if (form.skills.length === 0) missingRequired.push('At least one skill');

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Extraction warning */}
      {missingRequired.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Missing required fields:</strong> {missingRequired.join(', ')}.
          Please fill them in before confirming.
        </div>
      )}

      {/* Personal info */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Personal Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Full Name *', key: 'name', type: 'text' },
            { label: 'Email *', key: 'email', type: 'email' },
            { label: 'Phone', key: 'phone', type: 'tel' },
            { label: 'Location', key: 'location', type: 'text' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm
                           focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                placeholder={label.replace(' *', '')}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Summary */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Professional Summary *
        </h3>
        <textarea
          value={form.summary}
          onChange={(e) => setField('summary', e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                     focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none resize-y"
          placeholder="Describe your career background, key expertise, and professional goals…"
        />
        <p className="text-xs text-gray-400">
          This text (combined with your skills) is what the AI embeds to find matching jobs.
          The more descriptive, the better.
        </p>
      </section>

      {/* Skills */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Skills *
          </h3>
          <button
            type="button"
            onClick={addSkill}
            className="text-xs text-green-700 hover:text-green-900 font-medium"
          >
            + Add skill
          </button>
        </div>

        {form.skills.length === 0 && (
          <p className="text-sm text-gray-400 italic">
            No skills extracted. Add them manually using the button above.
          </p>
        )}

        <div className="space-y-2">
          {form.skills.map((skill, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Skill name"
                value={skill.name ?? ''}
                onChange={(e) => updateSkill(i, 'name', e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 outline-none"
              />
              <input
                type="text"
                placeholder="Area"
                value={skill.area ?? ''}
                onChange={(e) => updateSkill(i, 'area', e.target.value)}
                className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 outline-none"
              />
              <input
                type="number"
                placeholder="Yrs"
                value={skill.years ?? ''}
                min={0}
                max={50}
                onChange={(e) => updateSkill(i, 'years', e.target.value ? parseInt(e.target.value) : null)}
                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-green-500 outline-none"
              />
              <button
                type="button"
                onClick={() => removeSkill(i)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
                aria-label="Remove skill"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Confirm button */}
      <div className="pt-2">
        <button
          type="button"
          disabled={loading || missingRequired.length > 0}
          onClick={() => onConfirm(form)}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white
                     hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading ? 'Saving…' : 'Confirm & Submit Profile'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          After confirming, your profile will be embedded and saved, then you'll see your top job matches.
        </p>
      </div>
    </div>
  );
}
