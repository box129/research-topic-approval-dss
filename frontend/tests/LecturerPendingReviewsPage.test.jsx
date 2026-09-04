import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PendingReviewsPage from '../src/pages/lecturer/PendingReviewsPage';
import {
  listLecturerPendingSubmissions,
  listLecturerSubmissionSimilaritySnapshots,
  updateLecturerSubmissionStatus
} from '../src/api/submissions';
import { runLecturerSubmissionSimilarityCheck } from '../src/api/similarity';

vi.mock('../src/api/submissions', () => ({
  listLecturerPendingSubmissions: vi.fn(),
  listLecturerSubmissionSimilaritySnapshots: vi.fn(),
  updateLecturerSubmissionStatus: vi.fn()
}));

vi.mock('../src/api/similarity', () => ({
  runLecturerSubmissionSimilarityCheck: vi.fn()
}));

const pendingSubmissions = [
  {
    id: 1,
    title: 'Assessment of malaria prevention awareness among rural students',
    status: 'pending_review',
    category: 'Public Health',
    keywords: 'malaria, prevention',
    student_name: 'Ada Student',
    student_email: 'ada.student@uniosun.edu.ng',
    session_name: '2025/2026',
    submitted_at: '2026-05-20T10:00:00.000Z',
    risk_level: 'HIGH',
    max_similarity: 91,
    assigned_reviewer: 'Dr. Hidden Reviewer',
    activity: 'Fake activity item'
  },
  {
    id: 2,
    title: 'Machine learning models for library resource recommendation',
    status: 'pending_review',
    category: 'Computer Science',
    keywords: 'machine learning, library',
    student_name: 'Bola Student',
    student_email: 'bola.student@uniosun.edu.ng',
    session_name: '2024/2025',
    submitted_at: '2026-05-22T08:00:00.000Z',
    is_revision: true,
    revision_of: { decision_reason: 'Please narrow the study population before resubmitting.' }
  }
];

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderPendingReviewsPage() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/pending-reviews']}>
      <Routes>
        <Route path="/lecturer/pending-reviews" element={<PendingReviewsPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Lecturer PendingReviewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls listLecturerPendingSubmissions and shows loading state', () => {
    listLecturerPendingSubmissions.mockReturnValue(new Promise(() => {}));
    renderPendingReviewsPage();

    expect(screen.getByText(/loading pending reviews/i)).toBeInTheDocument();
    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(1);
  });

  it('shows API error fallback and retry', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions
      .mockRejectedValueOnce({
        response: { data: { message: 'Lecturer queue unavailable.' } }
      })
      .mockResolvedValueOnce([]);
    renderPendingReviewsPage();

    expect(await screen.findByText(/lecturer queue unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/no pending reviews/i)).toBeInTheDocument();
    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(2);
  });

  it('shows default API error fallback text', async () => {
    listLecturerPendingSubmissions.mockRejectedValue({});
    renderPendingReviewsPage();

    expect(await screen.findByText(/unable to load pending reviews/i)).toBeInTheDocument();
  });

  it('shows empty pending-review state', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderPendingReviewsPage();

    expect(await screen.findByRole('heading', { name: 'No pending reviews' })).toBeInTheDocument();
    expect(screen.getByText(/no submissions are currently waiting for your review\. newly submitted topics assigned to you will appear here\./i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /refresh queue/i }));

    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(2);
  });

  it('renders returned safe fields in the queue', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.getAllByText(/public health/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/keywords: malaria, prevention/i)).toBeInTheDocument();
    expect(screen.getByText(/ada student/i)).toBeInTheDocument();
    expect(screen.getByText(/ada\.student@uniosun\.edu\.ng/i)).toBeInTheDocument();
    expect(screen.getByText(/2025\/2026/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pending review/i).length).toBeGreaterThan(0);
  });

  it('links each row to the existing submission detail route', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /open review/i })[1]);

    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/pending-reviews/2');
  });

  it('supports client-side search', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'library');

    expect(screen.queryByText(/assessment of malaria prevention awareness/i)).not.toBeInTheDocument();
    expect(screen.getByText(/machine learning models for library/i)).toBeInTheDocument();
  });

  it('supports client-side category filter', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Computer Science');

    expect(screen.queryByText(/assessment of malaria prevention awareness/i)).not.toBeInTheDocument();
    expect(screen.getByText(/machine learning models for library/i)).toBeInTheDocument();
  });

  it('supports client-side oldest and newest sort', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    expect(document.body.textContent.indexOf('Assessment of malaria')).toBeLessThan(
      document.body.textContent.indexOf('Machine learning models')
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'newest');

    expect(document.body.textContent.indexOf('Machine learning models')).toBeLessThan(
      document.body.textContent.indexOf('Assessment of malaria')
    );
  });

  it('shows the filtered-empty state for a search mismatch and restores rows on clear', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'nothing matches this');

    expect(screen.getByText('No pending reviews match these filters.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear all filters/i }));

    expect(screen.getByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
  });

  it('does not call queue mutation, lecturer similarity, or snapshot helpers', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
    expect(runLecturerSubmissionSimilarityCheck).not.toHaveBeenCalled();
    expect(listLecturerSubmissionSimilaritySnapshots).not.toHaveBeenCalled();
  });

  it('does not show approve, request revision, or reject queue action buttons', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject in detail/i })).not.toBeInTheDocument();
  });

  it('does not expose fake risk scores, alerts, assignments, pagination, or activity', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.queryByText(/91/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/high-risk alert/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dr\. hidden reviewer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fake activity item/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/risk labels/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score summaries/i)).not.toBeInTheDocument();
  });
});

describe('Lecturer PendingReviewsPage — Board C C4 absence states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function expectNoDashedCentredPanel(container) {
    // The generic EmptyStatePanel geometry (dashed, centred, p-8 card) must
    // not carry either queue absence.
    const dashedPanels = [...container.querySelectorAll('[class*="border-dashed"]')]
      .filter((node) => node.className.includes('p-8') || node.className.includes('text-center'));
    expect(dashedPanels).toHaveLength(0);
  }

  it('C4a genuine empty renders the queue shell with truthful copy and no filter language', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderPendingReviewsPage();

    const section = await screen.findByTestId('pending-empty');
    expect(section).toHaveTextContent('Review queue');
    expect(screen.getByRole('heading', { name: 'No pending reviews' })).toBeInTheDocument();
    expect(section).toHaveTextContent('No submissions are currently waiting for your review. Newly submitted topics assigned to you will appear here.');

    expect(section.textContent).not.toMatch(/filter|match|search/i);
    expect(section.textContent).not.toMatch(/wrong|fail|error|unavailable/i);
    expect(section.textContent).not.toMatch(/similarity|original|unique/i);
    expectNoDashedCentredPanel(section);
  });

  it('C4a hides filter controls and keeps the summary counts at 0 / 0', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderPendingReviewsPage();

    await screen.findByTestId('pending-empty');
    expect(screen.queryByRole('searchbox', { name: /search queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /category/i })).not.toBeInTheDocument();
    const chipText = (expected) => (content, element) => element.tagName === 'P' && element.textContent.replace(/\s+/g, ' ').trim() === expected;
    expect(screen.getByText(chipText('Pending reviews 0'))).toBeInTheDocument();
    expect(screen.getByText(chipText('Visible after filters 0'))).toBeInTheDocument();
  });

  it('C4a offers Refresh Queue as a secondary utility and neutral onward routes', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderPendingReviewsPage();

    const section = await screen.findByTestId('pending-empty');
    const refresh = screen.getByRole('button', { name: /refresh queue/i });
    expect(refresh.className).toContain('border-border-strong');
    expect(refresh.className).not.toContain('bg-brand-green');

    expect(screen.getByRole('button', { name: 'View my decisions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View supervisees' })).toBeInTheDocument();
    // No primary "fix this" action exists in a state where nothing is wrong.
    expect(section.querySelector('[class*="bg-brand-green"]')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'View my decisions' }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/my-decisions');
  });

  it('C4a routes to supervisees via the existing route', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderPendingReviewsPage();

    await screen.findByTestId('pending-empty');
    await user.click(screen.getByRole('button', { name: 'View supervisees' }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/supervisees');
  });

  it('C4b renders the frozen filtered-empty copy while filter controls stay visible', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'nutrition');

    const section = screen.getByTestId('pending-filtered-empty');
    expect(screen.getByText('No pending reviews match these filters.')).toBeInTheDocument();
    expect(section).toHaveTextContent('Submissions may be waiting for your review but excluded by the search term or category above. Clear or change the filters to see them.');
    expect(section).toHaveTextContent('2 pending reviews · 0 shown');

    expect(screen.getByRole('searchbox', { name: /search queue/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
    // Never claims the source collection is empty.
    expect(section.textContent).not.toMatch(/no submissions are currently waiting/i);
    expect(screen.queryByTestId('pending-empty')).not.toBeInTheDocument();
    expectNoDashedCentredPanel(section);
  });

  it('C4b shows the active filters as removable chips of at least 32px targets', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'zzz-no-match');
    await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Public Health');

    const searchChip = screen.getByRole('button', { name: /remove search filter zzz-no-match/i });
    const categoryChip = screen.getByRole('button', { name: /remove category filter public health/i });
    expect(searchChip.className).toContain('min-h-8');
    expect(categoryChip.className).toContain('min-h-8');

    await user.click(categoryChip);
    expect(screen.queryByRole('button', { name: /remove category filter/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('pending-filtered-empty')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove search filter/i }));
    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
  });

  it('C4b Clear all filters restores rows without resetting the sort order', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'newest');
    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'zzz-no-match');

    expect(screen.getByTestId('pending-filtered-empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear all filters/i }));

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sort/i })).toHaveValue('newest');
    expect(screen.getByRole('searchbox', { name: /search queue/i })).toHaveValue('');
  });

  it('C4b derives the truthful hidden count from the loaded collection', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'zzz-no-match');

    expect(screen.getByTestId('hidden-count')).toHaveTextContent('2 submissions are pending review but hidden by these filters.');
  });

  it('C4b pluralises the hidden count truthfully for a single record', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([pendingSubmissions[0]]);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'zzz-no-match');

    expect(screen.getByTestId('hidden-count')).toHaveTextContent('1 submission is pending review but hidden by these filters.');
    expect(screen.getByTestId('pending-filtered-empty')).toHaveTextContent('1 pending review · 0 shown');
  });
});

// Board D2 — populated workflow-record grammar. The queue's Board C C4a/C4b
// branches are protected and untouched; these tests pin only the populated
// row semantics and the neutral summary.
describe('Lecturer PendingReviewsPage — Board D2 record grammar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const chip = (expected) => (content, element) => element.tagName === 'P' && element.textContent.replace(/\s+/g, ' ').trim().startsWith(expected);

  it('keeps the pending summary neutral even when work is waiting', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    const pendingChip = screen.getByText(chip('Pending reviews'));
    const visibleChip = screen.getByText(chip('Visible after filters'));
    expect(pendingChip.className).toContain('border-border-subtle');
    expect(pendingChip.className).not.toMatch(/warning|amber|gold/);
    expect(visibleChip.className).toContain('border-border-subtle');
    expect(visibleChip.className).not.toMatch(/warning|amber|gold/);
  });

  it('reads topic identity before the mobile workflow status', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    const title = await screen.findByText(/assessment of malaria prevention awareness/i);
    const article = title.closest('article');
    const mobileStatus = article.querySelector('div.lg\\:hidden');
    expect(mobileStatus).toHaveTextContent('Pending review');
    expect(title.compareDocumentPosition(mobileStatus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the revised-submission lineage marker as neutral metadata, never a workflow pill', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/machine learning models for library/i)).toBeInTheDocument();
    const marker = screen.getByTestId('queue-revision-marker-2');
    expect(marker).toHaveTextContent('Revised submission');
    expect(marker.className).toContain('text-sm');
    expect(marker.className).not.toMatch(/rounded-badge|status-revision|amber|gold|uppercase/);
  });

  it('renders the revision-request rationale at the 14px interpretive role', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/machine learning models for library/i)).toBeInTheDocument();
    const rationale = screen.getByText(/revision requested:/i).closest('p');
    expect(rationale.className).toContain('text-sm');
    expect(rationale.className).not.toContain('text-xs');
  });

  it('makes Open Review the primary product action that never wraps', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    const actions = screen.getAllByRole('button', { name: /open review/i });
    for (const action of actions) {
      expect(action.className).toContain('bg-brand-green');
      expect(action.className).toContain('whitespace-nowrap');
      expect(action.className).toContain('w-full');
      expect(action.className).toContain('lg:w-auto');
      expect(action.className).toContain('min-h-11');
    }

    await user.click(actions[1]);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/pending-reviews/2');
  });

  it('uses one identical grid definition for the desktop header and every row', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    const title = await screen.findByText(/assessment of malaria prevention awareness/i);
    const row = title.closest('article');
    const header = document.querySelector('div[class*="lg:grid-cols-"][class*="uppercase"]');
    const gridOf = (el) => el.className.match(/lg:grid-cols-\[[^\]]+\]/)?.[0];

    expect(gridOf(header)).toBeTruthy();
    expect(gridOf(row)).toBe(gridOf(header));
    // The representative long personal email fixture needs ~260px at the real
    // workspace widths, so the student minimum sits above the 220px floor.
    expect(gridOf(row)).toContain('minmax(260px,0.9fr)');
    expect(gridOf(row)).toContain('max-content');
  });
});
