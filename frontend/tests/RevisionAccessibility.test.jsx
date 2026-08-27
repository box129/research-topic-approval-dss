import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MySubmissionsPage from '../src/pages/student/MySubmissionsPage';
import PendingReviewsPage from '../src/pages/lecturer/PendingReviewsPage';
import { listLecturerPendingSubmissions, listSubmissions } from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  createRevisionSubmission: vi.fn(),
  createSubmission: vi.fn(),
  listSubmissions: vi.fn(),
  listLecturerPendingSubmissions: vi.fn(),
  listLecturerSubmissionSimilaritySnapshots: vi.fn().mockResolvedValue([]),
  updateLecturerSubmissionStatus: vi.fn()
}));

vi.mock('../src/api/similarity', () => ({ runLecturerSubmissionSimilarityCheck: vi.fn() }));
vi.mock('../src/layouts/StudentDashboardLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const LONG_FEEDBACK = 'Pleaseconsiderreducingtheextremelylongunbrokenscopeofthisproposedtopicimmediately '
  + 'and then narrow the population, state the study design, and justify the sampling frame in detail.';

/**
 * Accessibility and narrow-viewport checks for the screens this change touched.
 * Deliberately scoped to those screens: this is not a general accessibility
 * audit of the product.
 */
describe('changed flows remain readable and operable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('announces required action in words, not by colour alone', async () => {
    listSubmissions.mockResolvedValue([{
      id: 7,
      title: 'A topic awaiting revision',
      status: 'awaiting_revision',
      decision_reason: LONG_FEEDBACK,
      has_revision: false,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    render(<MemoryRouter><MySubmissionsPage /></MemoryRouter>);

    const banner = await screen.findByTestId('action-required-7');
    expect(banner).toHaveTextContent(/action required/i);
    // The status is also carried by the badge text and the derived label, so no
    // meaning depends on the colour of the card border alone.
    expect(screen.getByTestId('submission-state-7')).toHaveTextContent(/revision required/i);
  });

  it('wraps long lecturer feedback instead of overflowing the card', async () => {
    listSubmissions.mockResolvedValue([{
      id: 7,
      title: 'A topic awaiting revision',
      status: 'awaiting_revision',
      decision_reason: LONG_FEEDBACK,
      has_revision: false,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    render(<MemoryRouter><MySubmissionsPage /></MemoryRouter>);

    const feedback = await screen.findByTestId('feedback-7');
    expect(feedback.className).toContain('break-words');
    // Newlines the lecturer typed survive rather than collapsing into a wall.
    expect(feedback.className).toContain('whitespace-pre-line');
  });

  it('exposes the revise action as a real button with a touch-sized target', async () => {
    listSubmissions.mockResolvedValue([{
      id: 7,
      title: 'A topic awaiting revision',
      status: 'awaiting_revision',
      decision_reason: 'Narrow the population and state the study design.',
      has_revision: false,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    render(<MemoryRouter><MySubmissionsPage /></MemoryRouter>);

    const revise = await screen.findByRole('button', { name: /revise and resubmit/i });
    expect(revise).toBeEnabled();
    // Full width on narrow viewports, auto from the small breakpoint up.
    expect(revise.className).toContain('w-full');
    expect(revise.className).toContain('sm:w-auto');
  });

  it('keeps the matric number wrappable so narrow viewports do not scroll sideways', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([{
      id: 1,
      title: 'A submitted topic under review by the department lecturer',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      student_email: null,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    render(
      <MemoryRouter initialEntries={['/lecturer/pending-reviews']}>
        <Routes><Route path="/lecturer/pending-reviews" element={<PendingReviewsPage />} /></Routes>
      </MemoryRouter>
    );

    const matric = await screen.findByTestId('queue-student-1-matric');
    expect(matric.className).toContain('break-words');
  });

  it('keeps the revision history readable as an ordered list', async () => {
    listSubmissions.mockResolvedValue([{
      id: 9,
      title: 'The revised topic',
      status: 'pending_review',
      is_revision: true,
      revision_of: {
        id: 8,
        title: 'The original topic',
        decision_reason: LONG_FEEDBACK,
        decided_at: '2026-05-21T10:00:00.000Z',
        submitted_at: '2026-05-20T10:00:00.000Z'
      },
      submitted_at: '2026-05-22T10:00:00.000Z'
    }]);
    render(<MemoryRouter><MySubmissionsPage /></MemoryRouter>);

    const history = await screen.findByTestId('revision-history-9');
    const list = within(history).getByRole('list');
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(history).toHaveTextContent(/the original topic/i);
  });
});
