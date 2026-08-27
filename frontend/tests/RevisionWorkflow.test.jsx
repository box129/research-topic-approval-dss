import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SubmissionDetailPage from '../src/pages/lecturer/SubmissionDetailPage';
import SubmitTopicPage from '../src/pages/student/SubmitTopicPage';
import {
  createRevisionSubmission,
  getLecturerSubmission,
  listLecturerSubmissionSimilaritySnapshots,
  listSubmissions,
  updateLecturerSubmissionStatus
} from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  createRevisionSubmission: vi.fn(),
  createSubmission: vi.fn(),
  getLecturerSubmission: vi.fn(),
  listLecturerSubmissionSimilaritySnapshots: vi.fn(),
  listSubmissions: vi.fn(),
  updateLecturerSubmissionStatus: vi.fn()
}));

vi.mock('../src/api/similarity', () => ({
  runLecturerSubmissionSimilarityCheck: vi.fn()
}));

vi.mock('../src/layouts/StudentDashboardLayout', () => ({
  default: ({ children }) => <div>{children}</div>
}));

const awaitingRevision = {
  id: 8,
  title: 'Assessment of malaria prevention awareness among rural students',
  status: 'awaiting_revision',
  category: 'Public Health',
  keywords: 'malaria, prevention',
  population: 'Rural undergraduate students',
  location: 'Osun State',
  study_focus: 'Malaria prevention awareness',
  decision_reason: 'Narrow the population and state the study design.',
  decided_at: '2026-05-21T10:00:00.000Z',
  submitted_at: '2026-05-20T10:00:00.000Z',
  has_revision: false
};

function renderRevisePage(submissionId = 8) {
  return render(
    <MemoryRouter initialEntries={[`/student/my-submissions/${submissionId}/revise`]}>
      <Routes>
        <Route path="/student/my-submissions/:submissionId/revise" element={<SubmitTopicPage />} />
        <Route path="/student/my-submissions" element={<div>My Submissions screen</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('student revise and resubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSubmissions.mockResolvedValue([awaitingRevision]);
    createRevisionSubmission.mockResolvedValue({ id: 9, status: 'pending_review' });
  });

  it('starts from the existing topic and shows the feedback to address', async () => {
    renderRevisePage();

    expect(await screen.findByTestId('revision-feedback'))
      .toHaveTextContent(/narrow the population and state the study design/i);
    // The student edits rather than retypes, and never has to remember what was
    // asked for.
    expect(screen.getByLabelText(/research topic title/i)).toHaveValue(awaitingRevision.title);
    expect(screen.getByLabelText(/category/i)).toHaveValue('Public Health');
    expect(screen.getByLabelText(/keywords/i)).toHaveValue('malaria, prevention');
    // The context the original was embedded from is carried into the revision,
    // so the student revises the whole representation, not just the title.
    expect(screen.getByLabelText(/^population/i)).toHaveValue('Rural undergraduate students');
    expect(screen.getByLabelText(/^location/i)).toHaveValue('Osun State');
    expect(screen.getByLabelText(/^study focus/i)).toHaveValue('Malaria prevention awareness');
  });

  it('sends the revised context, not the original context, when the student changes it', async () => {
    const user = userEvent.setup();
    renderRevisePage();

    const population = await screen.findByLabelText(/^population/i);
    await user.clear(population);
    await user.type(population, 'Secondary school adolescents');
    await user.click(screen.getByRole('button', { name: /review and resubmit/i }));
    await user.click(screen.getByRole('button', { name: /confirm revision/i }));

    await waitFor(() => expect(createRevisionSubmission).toHaveBeenCalledTimes(1));
    expect(createRevisionSubmission.mock.calls[0][1]).toMatchObject({
      population: 'Secondary school adolescents',
      location: 'Osun State',
      studyFocus: 'Malaria prevention awareness'
    });
  });

  it('submits a revision linked to the original and keeps the original intact', async () => {
    const user = userEvent.setup();
    renderRevisePage();

    const title = await screen.findByLabelText(/research topic title/i);
    await user.clear(title);
    await user.type(title, 'Revised assessment of malaria prevention awareness in rural schools');
    await user.click(screen.getByRole('button', { name: /review and resubmit/i }));
    await user.click(screen.getByRole('button', { name: /confirm revision/i }));

    await waitFor(() => expect(createRevisionSubmission).toHaveBeenCalledTimes(1));
    expect(createRevisionSubmission).toHaveBeenCalledWith('8', {
      title: 'Revised assessment of malaria prevention awareness in rural schools',
      category: 'Public Health',
      keywords: 'malaria, prevention',
      population: 'Rural undergraduate students',
      location: 'Osun State',
      studyFocus: 'Malaria prevention awareness'
    });
    expect(await screen.findByTestId('submission-confirmation'))
      .toHaveTextContent(/your original submission is kept in your history/i);
  });

  it('does not create two revisions when the confirm button is double clicked', async () => {
    const user = userEvent.setup();
    let resolveRequest;
    createRevisionSubmission.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    renderRevisePage();

    await screen.findByLabelText(/research topic title/i);
    await user.click(screen.getByRole('button', { name: /review and resubmit/i }));
    const confirm = screen.getByRole('button', { name: /confirm revision/i });
    await user.click(confirm);
    await user.click(confirm);

    expect(createRevisionSubmission).toHaveBeenCalledTimes(1);
    resolveRequest({ id: 9 });
  });

  it('applies the same title rules as a first submission', async () => {
    const user = userEvent.setup();
    renderRevisePage();

    const title = await screen.findByLabelText(/research topic title/i);
    await user.clear(title);
    await user.type(title, 'Too short');
    await user.click(screen.getByRole('button', { name: /review and resubmit/i }));

    expect(screen.getByText(/title must be 7 to 24 words/i)).toBeInTheDocument();
    expect(createRevisionSubmission).not.toHaveBeenCalled();
    // Focus returns to the field that needs fixing.
    expect(await screen.findByLabelText(/research topic title/i)).toHaveFocus();
  });

  it.each([
    [{ ...awaitingRevision, status: 'pending_review' }, /not awaiting a revision/i],
    [{ ...awaitingRevision, has_revision: true }, /already submitted a revision/i]
  ])('refuses to revise an ineligible submission', async (submission, expected) => {
    listSubmissions.mockResolvedValue([submission]);
    renderRevisePage();

    expect(await screen.findByTestId('revision-unavailable')).toHaveTextContent(expected);
    expect(screen.queryByLabelText(/research topic title/i)).not.toBeInTheDocument();
  });

  it('reports an unknown submission honestly instead of offering a blank form', async () => {
    listSubmissions.mockResolvedValue([]);
    renderRevisePage(999);

    expect(await screen.findByTestId('revision-unavailable')).toHaveTextContent(/could not be found/i);
  });
});

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/pending-reviews/9']}>
      <Routes>
        <Route path="/lecturer/pending-reviews/:topicId" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('lecturer revision review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    updateLecturerSubmissionStatus.mockResolvedValue({});
  });

  it('shows the previous topic, the previous feedback and the current proposal', async () => {
    getLecturerSubmission.mockResolvedValue({
      id: 9,
      title: 'Revised assessment of malaria prevention awareness in rural schools',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      student_email: null,
      submitted_at: '2026-05-22T10:00:00.000Z',
      revision_of: {
        id: 8,
        title: awaitingRevision.title,
        keywords: 'malaria, prevention',
        status: 'awaiting_revision',
        decision_reason: 'Narrow the population and state the study design.',
        decided_at: '2026-05-21T10:00:00.000Z',
        submitted_at: '2026-05-20T10:00:00.000Z'
      }
    });
    renderDetail();

    const context = await screen.findByTestId('lecturer-revision-context');
    expect(within(context).getByTestId('revision-previous-title')).toHaveTextContent(awaitingRevision.title);
    expect(within(context).getByTestId('revision-previous-feedback'))
      .toHaveTextContent(/narrow the population and state the study design/i);
    expect(within(context).getByTestId('revision-current-title'))
      .toHaveTextContent(/revised assessment of malaria prevention awareness in rural schools/i);
    expect(screen.getByText(/^Revised topic$/i)).toBeInTheDocument();
  });

  it('identifies the student by matric and omits an absent email', async () => {
    getLecturerSubmission.mockResolvedValue({
      id: 9,
      title: 'Assessment of malaria prevention awareness among rural students',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      student_email: null,
      submitted_at: '2026-05-20T10:00:00.000Z'
    });
    renderDetail();

    expect(await screen.findByText('PHS/22/0042')).toBeInTheDocument();
    expect(screen.queryByText(/personal email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no email available/i)).not.toBeInTheDocument();
  });

  it('refuses to request a revision without feedback', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue({
      id: 9,
      title: 'Assessment of malaria prevention awareness among rural students',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      submitted_at: '2026-05-20T10:00:00.000Z'
    });
    renderDetail();

    await screen.findByText('PHS/22/0042');
    await user.click(screen.getByRole('button', { name: /request revision/i }));

    // The whole point of the action is to tell the student what to change, so
    // it cannot be sent empty.
    expect(screen.getByText(/revision feedback is required so the student knows what to change/i))
      .toBeInTheDocument();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/decision rationale/i)).toHaveFocus();
  });

  it('rejects token revision feedback', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue({
      id: 9,
      title: 'Assessment of malaria prevention awareness among rural students',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      submitted_at: '2026-05-20T10:00:00.000Z'
    });
    renderDetail();

    await screen.findByText('PHS/22/0042');
    await user.type(screen.getByLabelText(/decision rationale/i), 'no');
    await user.click(screen.getByRole('button', { name: /request revision/i }));

    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
  });

  it('sends a revision request once real feedback is supplied', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue({
      id: 9,
      title: 'Assessment of malaria prevention awareness among rural students',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      submitted_at: '2026-05-20T10:00:00.000Z'
    });
    renderDetail();

    await screen.findByText('PHS/22/0042');
    await user.type(
      screen.getByLabelText(/decision rationale/i),
      'Narrow the population and state the study design.'
    );
    await user.click(screen.getByRole('button', { name: /request revision/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /request revision/i }));

    await waitFor(() => expect(updateLecturerSubmissionStatus).toHaveBeenCalledTimes(1));
    expect(updateLecturerSubmissionStatus).toHaveBeenCalledWith(
      '9',
      'awaiting_revision',
      'Narrow the population and state the study design.'
    );
  });

  it('does not show revision context on an ordinary first submission', async () => {
    getLecturerSubmission.mockResolvedValue({
      id: 9,
      title: 'Assessment of malaria prevention awareness among rural students',
      status: 'pending_review',
      student_name: 'Ada Student',
      student_matric_number: 'PHS/22/0042',
      submitted_at: '2026-05-20T10:00:00.000Z'
    });
    renderDetail();

    await screen.findByText('PHS/22/0042');
    expect(screen.queryByTestId('lecturer-revision-context')).not.toBeInTheDocument();
    expect(screen.getByText(/^Submitted topic$/i)).toBeInTheDocument();
  });
});
