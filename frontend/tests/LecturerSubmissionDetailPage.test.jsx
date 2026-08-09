import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SubmissionDetailPage from '../src/pages/lecturer/SubmissionDetailPage';
import {
  getLecturerSubmission,
  listLecturerSubmissionSimilaritySnapshots,
  updateLecturerSubmissionStatus
} from '../src/api/submissions';
import { runLecturerSubmissionSimilarityCheck } from '../src/api/similarity';

vi.mock('../src/api/submissions', () => ({
  getLecturerSubmission: vi.fn(),
  listLecturerSubmissionSimilaritySnapshots: vi.fn(),
  updateLecturerSubmissionStatus: vi.fn()
}));

vi.mock('../src/api/similarity', () => ({
  runLecturerSubmissionSimilarityCheck: vi.fn()
}));

const pendingSubmission = {
  id: 42,
  title: 'Assessment of malaria prevention awareness among rural students',
  status: 'pending_review',
  category: 'Public Health',
  keywords: 'malaria, prevention',
  student_name: 'Ada Student',
  student_email: 'ada.student@uniosun.edu.ng',
  session_name: '2025/2026',
  submitted_at: '2026-05-20T10:00:00.000Z',
  created_at: '2026-05-19T10:00:00.000Z'
};

const approvedSubmission = {
  ...pendingSubmission,
  status: 'approved',
  decision_reason: 'Approved after review.',
  decided_by_name: 'Dr. Lecturer',
  decided_at: '2026-05-25T10:00:00.000Z'
};

const snapshot = {
  id: 7,
  overall_risk: 'HIGH',
  response_status: 'success',
  checked_by: {
    name: 'Dr. Similarity',
    email: 'similarity@uniosun.edu.ng'
  },
  created_at: '2026-05-21T10:00:00.000Z',
  max_similarity: 87.45,
  result_summary: {
    tierCounts: {
      historical: 2,
      currentSession: 1,
      underReview: 3
    }
  },
  recommendation: 'Review the high overlap before deciding.'
};

function buildSimilarityResponse({ risk = 'LOW', status = 'success' } = {}) {
  return {
    status,
    message: status === 'partial_success' ? 'Semantic analysis is temporarily unavailable.' : '',
    results: {
      risk_level: risk,
      max_similarity: risk === 'HIGH' ? 88 : 18,
      recommendation: `${risk} recommendation from service.`,
      sbert_available: status !== 'partial_success',
      tier1_matches: [
        {
          id: 1,
          topic_title: 'Similar historical topic',
          supervisor_name: 'Dr. Prior',
          session_year: '2024/2025',
          jaccard_score: 18,
          tfidf_score: 14,
          sbert_score: 16,
          combined_similarity_score: risk === 'HIGH' ? 88 : 18
        }
      ],
      tier2_matches: [],
      tier3_matches: []
    }
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/pending-reviews/42']}>
      <Routes>
        <Route path="/lecturer/pending-reviews/:topicId" element={<SubmissionDetailPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Lecturer SubmissionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getLecturerSubmission and listLecturerSubmissionSimilaritySnapshots with the route id', async () => {
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(getLecturerSubmission).toHaveBeenCalledWith('42');
    expect(listLecturerSubmissionSimilaritySnapshots).toHaveBeenCalledWith('42');
  });

  it('shows loading state', () => {
    getLecturerSubmission.mockReturnValue(new Promise(() => {}));
    listLecturerSubmissionSimilaritySnapshots.mockReturnValue(new Promise(() => {}));
    renderDetailPage();

    expect(screen.getByText(/loading submission details/i)).toBeInTheDocument();
  });

  it('shows detail load error with retry', async () => {
    const user = userEvent.setup();
    getLecturerSubmission
      .mockRejectedValueOnce({
        response: { data: { message: 'Submission detail unavailable.' } }
      })
      .mockResolvedValueOnce(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderDetailPage();

    expect(await screen.findByText(/submission detail unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(getLecturerSubmission).toHaveBeenCalledTimes(2);
  });

  it('renders safe submission metadata and preserves back link', async () => {
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.getByText(/ada student/i)).toBeInTheDocument();
    expect(screen.getByText(/ada\.student@uniosun\.edu\.ng/i)).toBeInTheDocument();
    expect(screen.getByText(/public health/i)).toBeInTheDocument();
    expect(screen.getByText(/malaria, prevention/i)).toBeInTheDocument();
    expect(screen.getByText(/2025\/2026/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to pending reviews/i })).toHaveAttribute(
      'href',
      '/lecturer/pending-reviews'
    );
  });

  it('renders empty snapshot history', async () => {
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderDetailPage();

    expect(await screen.findByText(/no saved similarity checks/i)).toBeInTheDocument();
    expect(screen.getByText(/no similarity checks have been saved/i)).toBeInTheDocument();
  });

  it('renders snapshot history with risk, checked-by, date, max similarity, tier counts, and recommendation', async () => {
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([snapshot]);
    renderDetailPage();

    expect(await screen.findByText(/review the high overlap/i)).toBeInTheDocument();
    expect(screen.getByText(/^HIGH$/i)).toBeInTheDocument();
    expect(screen.getByText(/checked by dr\. similarity/i)).toBeInTheDocument();
    expect(screen.getByText(/similarity@uniosun\.edu\.ng/i)).toBeInTheDocument();
    expect(screen.getByText(/may 21, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/max similarity: 87\.5%/i)).toBeInTheDocument();
    expect(screen.getByText(/historical: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/current session: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/under review: 3/i)).toBeInTheDocument();
  });

  it('shows snapshot load error and retry', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots
      .mockRejectedValueOnce({
        response: { data: { message: 'Snapshot service unavailable.' } }
      })
      .mockResolvedValueOnce([snapshot]);
    renderDetailPage();

    expect(await screen.findByText(/snapshot service unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/review the high overlap/i)).toBeInTheDocument();
    expect(listLecturerSubmissionSimilaritySnapshots).toHaveBeenCalledTimes(2);
  });

  it('runs lecturer similarity check and refreshes snapshot history after success', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([snapshot]);
    runLecturerSubmissionSimilarityCheck.mockResolvedValue(buildSimilarityResponse({ risk: 'LOW' }));
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run similarity check/i }));

    expect(await screen.findByTestId('results-display')).toBeInTheDocument();
    expect(runLecturerSubmissionSimilarityCheck).toHaveBeenCalledWith(42);
    expect(listLecturerSubmissionSimilaritySnapshots).toHaveBeenCalledTimes(2);
  });

  it('displays similarity loading and errors', async () => {
    const user = userEvent.setup();
    let resolveCheck;
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    runLecturerSubmissionSimilarityCheck
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveCheck = resolve;
      }))
      .mockRejectedValueOnce({
        response: { data: { message: 'Similarity service failed.' } }
      });
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run similarity check/i }));
    expect(screen.getByText(/running similarity check/i)).toBeInTheDocument();
    resolveCheck(buildSimilarityResponse());
    expect(await screen.findByTestId('results-display')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run similarity check/i }));
    expect(await screen.findByText(/similarity service failed/i)).toBeInTheDocument();
  });

  it('displays partial-success notice and ResultsDisplay behavior', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    runLecturerSubmissionSimilarityCheck.mockResolvedValue(buildSimilarityResponse({
      risk: 'MEDIUM',
      status: 'partial_success'
    }));
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run similarity check/i }));

    expect(await screen.findByText(/partial analysis/i)).toBeInTheDocument();
    expect(screen.getAllByText(/semantic analysis is temporarily unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('results-display')).toBeInTheDocument();
    expect(screen.getByTestId('sbert-warning')).toBeInTheDocument();
  });

  it('validates rejection rationale before update', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    expect(screen.getByText(/decision rationale is required/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/decision rationale/i)).toHaveFocus());
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens confirmation modal before approve and preserves status payload', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    updateLecturerSubmissionStatus.mockResolvedValue(approvedSubmission);
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^approve$/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /confirm lecturer decision/i })).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      expect(updateLecturerSubmissionStatus).toHaveBeenCalledWith('42', 'approved', '');
    });
    expect(await screen.findByText(/submission approved successfully/i)).toBeInTheDocument();
  });

  it('opens confirmation modal before request revision and preserves rationale payload', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    updateLecturerSubmissionStatus.mockResolvedValue({
      ...pendingSubmission,
      status: 'awaiting_revision',
      decision_reason: 'Please narrow the research scope.'
    });
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/decision rationale/i), 'Please narrow the research scope.');
    await user.click(screen.getByRole('button', { name: /request revision/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /confirm lecturer decision/i })).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /request revision/i }));

    await waitFor(() => {
      expect(updateLecturerSubmissionStatus).toHaveBeenCalledWith(
        '42',
        'awaiting_revision',
        'Please narrow the research scope.'
      );
    });
    expect(screen.queryByDisplayValue(/please narrow/i)).not.toBeInTheDocument();
  });

  it('opens confirmation modal before reject and preserves status payload', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    updateLecturerSubmissionStatus.mockResolvedValue({
      ...pendingSubmission,
      status: 'rejected',
      decision_reason: 'Too much overlap.'
    });
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/decision rationale/i), 'Too much overlap.');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /confirm lecturer decision/i })).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      expect(updateLecturerSubmissionStatus).toHaveBeenCalledWith('42', 'rejected', 'Too much overlap.');
    });
  });

  it('disables decision actions for non-pending submissions and displays stored lecturer rationale', async () => {
    getLecturerSubmission.mockResolvedValue(approvedSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderDetailPage();

    expect(await screen.findByText(/approved after review/i)).toBeInTheDocument();
    expect(screen.getByText(/actions are disabled/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^approve$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /request revision/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeDisabled();
    expect(screen.getByText(/decided by dr\. lecturer/i)).toBeInTheDocument();
  });

  it('does not call unrelated endpoints or invent fake risk, snapshot, or decision data', async () => {
    getLecturerSubmission.mockResolvedValue({
      ...pendingSubmission,
      fake_risk: 'CRITICAL',
      fake_snapshot: 'Invented snapshot',
      fake_decision: 'Auto rejected'
    });
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderDetailPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(runLecturerSubmissionSimilarityCheck).not.toHaveBeenCalled();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
    expect(screen.queryByText(/critical/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invented snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auto rejected/i)).not.toBeInTheDocument();
  });
});
