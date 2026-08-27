import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PendingReviewsPage from '../src/pages/lecturer/PendingReviewsPage';
import {
  listLecturerPendingSubmissions,
  listLecturerSubmissionSimilaritySnapshots,
  updateLecturerSubmissionStatus
} from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  listLecturerPendingSubmissions: vi.fn(),
  listLecturerSubmissionSimilaritySnapshots: vi.fn(),
  updateLecturerSubmissionStatus: vi.fn()
}));

vi.mock('../src/api/similarity', () => ({
  runLecturerSubmissionSimilarityCheck: vi.fn()
}));

function renderQueue() {
  return render(<MemoryRouter initialEntries={['/lecturer/pending-reviews']}><PendingReviewsPage /></MemoryRouter>);
}

/**
 * Students are identified by matric number and may legitimately have no email.
 * A lecturer must therefore always be able to tell whose topic they are reading,
 * and the absence of an email must never be presented as a missing record.
 */
describe('review queue student identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    updateLecturerSubmissionStatus.mockResolvedValue({});
  });

  it('identifies a student who has no email by matric number', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([{
      id: 1,
      title: 'Assessment of malaria prevention awareness among rural students',
      status: 'pending_review',
      category: 'Public Health',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      student_email: null,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    renderQueue();

    expect(await screen.findByTestId('queue-student-1-matric')).toHaveTextContent('PHS/22/0042');
    expect(screen.getByTestId('queue-student-1-name')).toHaveTextContent('Ada Student');
    // The regression this replaces: a normal no-email student used to be
    // rendered as though something was wrong with the record.
    expect(screen.queryByText(/no email available/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('queue-student-1-email')).not.toBeInTheDocument();
  });

  it('shows an email as secondary detail when the student has one', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([{
      id: 2,
      title: 'Machine learning models for library resource recommendation',
      status: 'pending_review',
      student_name: 'Bola Student',
      student_matric_number: 'PHS/22/0043',
      student_email: 'personal.address@example.com',
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    renderQueue();

    expect(await screen.findByTestId('queue-student-2-matric')).toHaveTextContent('PHS/22/0043');
    expect(screen.getByTestId('queue-student-2-email')).toHaveTextContent('personal.address@example.com');
  });

  it('lets a lecturer find a submission by matric number', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Assessment of malaria prevention awareness among rural students',
        status: 'pending_review',
        student_name: 'Ada Student',
        student_matric_number: 'PHS/22/0042',
        student_email: null,
        submitted_at: '2026-05-20T10:00:00.000Z'
      },
      {
        id: 2,
        title: 'Machine learning models for library resource recommendation',
        status: 'pending_review',
        student_name: 'Bola Student',
        student_matric_number: 'PHS/22/0043',
        student_email: null,
        submitted_at: '2026-05-20T10:00:00.000Z'
      }
    ]);
    renderQueue();

    await screen.findByTestId('queue-student-1-matric');
    const search = screen.getByRole('searchbox');
    await user.type(search, 'PHS/22/0043');

    expect(screen.queryByTestId('queue-student-1-matric')).not.toBeInTheDocument();
    expect(screen.getByTestId('queue-student-2-matric')).toHaveTextContent('PHS/22/0043');
  });

  it('marks a revised submission in the queue with the feedback that produced it', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([{
      id: 3,
      title: 'Revised assessment of malaria prevention awareness in rural schools',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      student_email: null,
      is_revision: true,
      revision_of: {
        id: 1,
        title: 'Assessment of malaria prevention awareness among rural students',
        decision_reason: 'Narrow the population and state the study design.',
        decided_at: '2026-05-21T10:00:00.000Z',
        submitted_at: '2026-05-20T10:00:00.000Z'
      },
      submitted_at: '2026-05-22T10:00:00.000Z'
    }]);
    renderQueue();

    expect(await screen.findByTestId('queue-revision-marker-3')).toHaveTextContent(/revised submission/i);
    expect(screen.getByText(/narrow the population and state the study design/i)).toBeInTheDocument();
  });

  it('does not mark an ordinary first submission as a revision', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([{
      id: 4,
      title: 'A perfectly ordinary first submission about health awareness',
      status: 'pending_review',
      student_name: 'Chidi Student',
      student_matric_number: 'PHS/22/0044',
      student_email: null,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    renderQueue();

    await screen.findByTestId('queue-student-4-matric');
    expect(screen.queryByTestId('queue-revision-marker-4')).not.toBeInTheDocument();
  });

  it('reports a legacy record with no matric number honestly', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([{
      id: 5,
      title: 'A legacy submission predating matric-primary identity records',
      status: 'pending_review',
      student_name: 'Legacy Student',
      student_matric_number: null,
      student_email: null,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    renderQueue();

    const row = (await screen.findByTestId('queue-student-5-name')).closest('div');
    expect(within(row).getByTestId('queue-student-5-matric-missing'))
      .toHaveTextContent(/no matric number on record/i);
  });
});
