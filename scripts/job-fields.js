// Shared job-application field catalog — used by BOTH the public careers page
// (to render each job's form) and the admin (to toggle which fields a job asks for).
// first_name, last_name, and email are ALWAYS collected; these are the optional
// add-ons an admin can enable per job.
(function () {
  window.REVIVE_JOB_FIELDS = [
    { key: 'phone',            label: 'Phone number',            type: 'tel' },
    { key: 'resume_url',       label: 'Resume / CV',             type: 'file',     accept: '.pdf,.doc,.docx', hint: 'Upload a PDF or Word doc — max 3MB' },
    { key: 'cover_letter',     label: 'Cover letter',            type: 'file',     accept: '.pdf,.doc,.docx,.txt', hint: 'Upload a PDF, Word doc, or text file — max 3MB' },
    { key: 'linkedin',         label: 'LinkedIn profile',        type: 'url' },
    { key: 'portfolio',        label: 'Portfolio / website',     type: 'url' },
    { key: 'years_experience', label: 'Years of experience',     type: 'text' },
    { key: 'certifications',   label: 'Certifications',          type: 'textarea', hint: 'e.g. NASM CPT, CPR/AED, CrossFit L1' },
    { key: 'availability',     label: 'Availability',            type: 'textarea', hint: 'Which days/times can you work?' },
    { key: 'start_date',       label: 'Earliest start date',     type: 'text' },
    { key: 'desired_pay',      label: 'Desired pay',             type: 'text' },
    { key: 'referral',         label: 'How did you hear about us?', type: 'text' },
  ];
  window.REVIVE_JOB_FIELD_MAP = window.REVIVE_JOB_FIELDS.reduce(function (m, f) { m[f.key] = f; return m; }, {});
})();
