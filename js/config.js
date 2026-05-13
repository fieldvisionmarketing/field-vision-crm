// Field Vision CRM V2 - Configuration
export const SUPABASE_URL = 'https://bmdrbuczkjekdnpmjajw.supabase.co/rest/v1';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtZHJidWN6a2pla2RucG1qYWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjY3MTEsImV4cCI6MjA5NDIwMjcxMX0.JEEMf-UzmPzOk_-2vWJ99UH95FmPiyfnxFM4m-wb0Lg';

export const TABS = [
  { id: 'sales', label: 'Sales' },
  { id: 'bd', label: 'Business Development' },
  { id: 'protemoi', label: 'Protemoi' },
  { id: 'vc_recruiters', label: 'VC / Recruiters' },
  { id: 'berkeley', label: 'Berkeley' },
];

// Column definitions per tab
export const TAB_COLUMNS = {
  sales: [
    { key: 'company', label: 'Company', type: 'text', width: '140px' },
    { key: 'contact_name', label: 'Contact', type: 'text', width: '160px' },
    { key: 'phase', label: 'Phase', type: 'select', width: '150px',
      options: ['1. Discovery', '2. Refinement', '3. Proposal', '4. Closed - Won', '5. Closed - Lost', 'Paused'] },
    { key: 'priority', label: 'Priority', type: 'priority', width: '80px' },
    { key: 'date_of_last_contact', label: 'DOLC', type: 'date', width: '110px' },
    { key: 'next_step', label: 'Next Step', type: 'text', width: '200px' },
    { key: 'notes', label: 'Notes', type: 'text', width: '200px' },
    { key: 'folder', label: 'Folder', type: 'text', width: '120px' },
    { key: 'date_initiated', label: 'Initiated', type: 'date', width: '110px' },
  ],
  bd: [
    { key: 'company', label: 'Company', type: 'text', width: '140px' },
    { key: 'contact_name', label: 'Contact', type: 'text', width: '160px' },
    { key: 'linkedin_url', label: 'LinkedIn', type: 'link', width: '60px' },
    { key: 'status', label: 'Status', type: 'select', width: '140px',
      options: ['New Prospect', 'Cold Outreach', 'Initial Outreach', 'Replied', 'In Conversation', 'Meeting Set', 'Engaged', 'Needs Follow-Up', 'Up Next', 'Ghosted', 'Dead', 'Deprecated / Purgatory'] },
    { key: 'priority', label: 'Priority', type: 'priority', width: '80px' },
    { key: 'phase', label: 'Phase', type: 'select', width: '160px',
      options: ['Phase 1 - Opening', 'Phase 2 - Warming', 'Phase 3 - Qualifying', 'Phase 4 - Proposing', 'Phase 5 - Closing', 'Phase 6 - Stalled'] },
    { key: 'date_of_last_contact', label: 'DOLC', type: 'date', width: '110px' },
    { key: 'notes', label: 'Notes', type: 'text', width: '200px' },
    { key: 'date_initiated', label: 'Initiated', type: 'date', width: '110px' },
    { key: 'folder', label: 'Folder', type: 'text', width: '120px' },
  ],
  protemoi: [
    { key: 'company', label: 'Name', type: 'text', width: '160px' },
    { key: 'contact_name', label: 'Role', type: 'text', width: '160px' },
    { key: 'linkedin_url', label: 'LinkedIn', type: 'link', width: '60px' },
    { key: 'tier', label: 'Tier', type: 'select', width: '130px',
      options: ['Tier One', 'Tier Two', 'Keeping Warm', 'Up Next', 'Shelved'] },
    { key: 'date_of_last_contact', label: 'DOLC', type: 'date', width: '110px' },
    { key: 'notes', label: 'Notes', type: 'text', width: '280px' },
  ],
  vc_recruiters: [
    { key: 'company', label: 'Company', type: 'text', width: '160px' },
    { key: 'contact_name', label: 'Contact', type: 'text', width: '160px' },
    { key: 'role', label: 'Role', type: 'text', width: '140px' },
    { key: 'linkedin_url', label: 'LinkedIn', type: 'link', width: '60px' },
    { key: 'contact_type', label: 'Type', type: 'select', width: '120px',
      options: ['VC', 'Recruiter', 'Investor', 'Advisor'] },
    { key: 'date_of_last_contact', label: 'DOLC', type: 'date', width: '110px' },
    { key: 'notes', label: 'Notes', type: 'text', width: '280px' },
  ],
  berkeley: [
    { key: 'company', label: 'Name', type: 'text', width: '180px' },
    { key: 'contact_name', label: 'Contact', type: 'text', width: '160px' },
    { key: 'linkedin_url', label: 'LinkedIn', type: 'link', width: '60px' },
    { key: 'date_of_last_contact', label: 'DOLC', type: 'date', width: '110px' },
    { key: 'notes', label: 'Notes', type: 'text', width: '320px' },
  ],
};
