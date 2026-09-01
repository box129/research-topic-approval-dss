import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SubmissionDetailPage from '../src/pages/lecturer/SubmissionDetailPage';
import {
  getLecturerSubmission,
  listLecturerSubmissionSimilaritySnapshots
} from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  getLecturerSubmission: vi.fn(),
  listLecturerSubmissionSimilaritySnapshots: vi.fn(),
  updateLecturerSubmissionStatus: vi.fn()
}));

vi.mock('../src/api/similarity', () => ({
  runLecturerSubmissionSimilarityCheck: vi.fn()
}));

const CURRENT_CONTRACT = 'voyage-raw-cosine-v1';

const submission = {
  id: 42,
  title: 'Assessment of malaria prevention awareness among rural students',
  status: 'pending_review',
  student_name: 'Ada Student',
  session_name: '2025/2026',
  submitted_at: '2026-05-20T10:00:00.000Z'
};

function buildSnapshot(id, overrides = {}) {
  return {
    id,
    overall_risk: 'MEDIUM',
    response_status: 'success',
    checked_by: { name: 'Dr. Similarity', email: 'similarity@uniosun.edu.ng' },
    created_at: '2026-09-01T09:00:00.000Z',
    result_summary: { tierCounts: { historical: 1, currentSession: 0, underReview: 0 } },
    recommendation: 'Advisory recommendation.',
    ...overrides
  };
}

function renderWithSnapshots(snapshots) {
  getLecturerSubmission.mockResolvedValue(submission);
  listLecturerSubmissionSimilaritySnapshots.mockResolvedValue(snapshots);

  return render(
    <MemoryRouter initialEntries={['/lecturer/pending-reviews/42']}>
      <Routes>
        <Route path="/lecturer/pending-reviews/:topicId" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function scoreCard(id) {
  return screen.findByTestId(`snapshot-score-${id}`);
}

describe('Similarity snapshot scoring-contract display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders marked current snapshots as raw cosine with three decimals and no percent sign', async () => {
    renderWithSnapshots([
      buildSnapshot(101, { scoring_contract: CURRENT_CONTRACT, max_similarity: 0.623 }),
      buildSnapshot(102, { scoring_contract: CURRENT_CONTRACT, max_similarity: 0.7206525778154617 }),
      buildSnapshot(103, { scoring_contract: CURRENT_CONTRACT, max_similarity: 0 }),
      buildSnapshot(104, { scoring_contract: CURRENT_CONTRACT, max_similarity: -0.081365 })
    ]);

    expect(await scoreCard(101)).toHaveTextContent(/^Max similarity: 0\.623$/);
    expect(await scoreCard(102)).toHaveTextContent(/^Max similarity: 0\.721$/);
    expect(await scoreCard(103)).toHaveTextContent(/^Max similarity: 0\.000$/);
    expect(await scoreCard(104)).toHaveTextContent(/^Max similarity: -0\.081$/);

    for (const id of [101, 102, 103, 104]) {
      expect(screen.getByTestId(`snapshot-score-${id}`)).not.toHaveTextContent('%');
      expect(screen.queryByTestId(`snapshot-contract-note-${id}`)).not.toBeInTheDocument();
    }
  });

  it('renders a marked current snapshot with null max similarity as N/A', async () => {
    renderWithSnapshots([
      buildSnapshot(105, { scoring_contract: CURRENT_CONTRACT, max_similarity: null, overall_risk: null })
    ]);

    expect(await scoreCard(105)).toHaveTextContent(/^Max similarity: N\/A$/);
  });

  it('renders an unmarked legacy value as stored, without a percent sign or cosine claim, with the historical note', async () => {
    renderWithSnapshots([
      buildSnapshot(201, { max_similarity: 81.4 })
    ]);

    const card = await scoreCard(201);
    expect(card).toHaveTextContent('Recorded score: 81.4');
    expect(card).not.toHaveTextContent('%');
    expect(card).not.toHaveTextContent('Max similarity');
    expect(screen.getByTestId('snapshot-contract-note-201')).toHaveTextContent(
      /historical scoring contract not recorded/i
    );
    expect(screen.getByTestId('snapshot-contract-note-201')).toHaveTextContent(
      /shown as stored and is not directly comparable with current cosine scores/i
    );
  });

  it('does not present an unmarked stored zero as an asserted current cosine 0.000', async () => {
    renderWithSnapshots([
      buildSnapshot(202, { max_similarity: 0 })
    ]);

    const card = await scoreCard(202);
    expect(card).toHaveTextContent('Recorded score: 0');
    expect(card).not.toHaveTextContent('0.000');
    expect(card).not.toHaveTextContent('Max similarity');
    expect(screen.getByTestId('snapshot-contract-note-202')).toBeInTheDocument();
  });

  it('treats an unmarked voyage-like value as contract-unknown: marker presence, not numeric range, decides', async () => {
    renderWithSnapshots([
      buildSnapshot(203, { max_similarity: 0.623 })
    ]);

    const card = await scoreCard(203);
    expect(card).toHaveTextContent('Recorded score: 0.623');
    expect(card).not.toHaveTextContent('Max similarity');
    expect(screen.getByTestId('snapshot-contract-note-203')).toBeInTheDocument();
  });

  it('renders an unmarked snapshot with null max similarity as N/A without the historical note', async () => {
    renderWithSnapshots([
      buildSnapshot(204, { max_similarity: null, overall_risk: null })
    ]);

    const card = await scoreCard(204);
    expect(card).toHaveTextContent('Recorded score: N/A');
    expect(screen.queryByTestId('snapshot-contract-note-204')).not.toBeInTheDocument();
  });

  it('keeps the current classification presentation for marked snapshots', async () => {
    renderWithSnapshots([
      buildSnapshot(401, { scoring_contract: CURRENT_CONTRACT, max_similarity: 0.7, overall_risk: 'HIGH' })
    ]);

    expect(await scoreCard(401)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.queryByTestId('snapshot-recorded-classification-401')).not.toBeInTheDocument();
    expect(screen.queryByText(/recorded classification/i)).not.toBeInTheDocument();
  });

  it('labels an unmarked stored classification as recorded metadata and never recomputes it from the stored number', async () => {
    // Stored LOW beside a stored number (81.4) that current Voyage thresholds
    // would call HIGH — if anything recomputed classification from the value,
    // HIGH would render and this test would fail.
    renderWithSnapshots([
      buildSnapshot(402, { max_similarity: 81.4, overall_risk: 'LOW' })
    ]);

    const recordedClassification = await screen.findByTestId('snapshot-recorded-classification-402');
    expect(recordedClassification).toHaveTextContent(/recorded classification/i);
    expect(recordedClassification).toHaveTextContent('LOW');
    expect(screen.queryByText('HIGH')).not.toBeInTheDocument();
    expect(screen.getByTestId('snapshot-contract-note-402')).toBeInTheDocument();
  });

  it('keeps marked and unmarked rows on their own presentations when mixed in one history list', async () => {
    renderWithSnapshots([
      buildSnapshot(301, { scoring_contract: CURRENT_CONTRACT, max_similarity: 0.623 }),
      buildSnapshot(302, { max_similarity: 81.4 })
    ]);

    expect(await scoreCard(301)).toHaveTextContent(/^Max similarity: 0\.623$/);
    expect(await scoreCard(302)).toHaveTextContent('Recorded score: 81.4');
    expect(screen.queryByTestId('snapshot-contract-note-301')).not.toBeInTheDocument();
    expect(screen.getByTestId('snapshot-contract-note-302')).toBeInTheDocument();
  });
});
