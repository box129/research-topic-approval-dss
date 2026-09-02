import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// A terminal record renders the history register expanded by default, so the
// scoring-contract cells are directly assertable.
const submission = {
  id: 42,
  title: 'Assessment of malaria prevention awareness among rural students',
  status: 'rejected',
  decision_reason: 'Too much overlap with stored records.',
  decided_by_name: 'Dr. Lecturer',
  decided_at: '2026-09-01T12:00:00.000Z',
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

async function scoreCell(id) {
  return screen.findByTestId(`snapshot-score-${id}`);
}

describe('Similarity snapshot scoring-contract display (history register)', () => {
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

    expect(await scoreCell(101)).toHaveTextContent(/^cosine 0\.623$/);
    expect(await scoreCell(102)).toHaveTextContent(/^cosine 0\.721$/);
    expect(await scoreCell(103)).toHaveTextContent(/^cosine 0\.000$/);
    expect(await scoreCell(104)).toHaveTextContent(/^cosine -0\.081$/);

    for (const id of [101, 102, 103, 104]) {
      expect(screen.getByTestId(`snapshot-score-${id}`)).not.toHaveTextContent('%');
      // Marked rows use the current similarity-classification terminology.
      expect(screen.getByTestId(`register-class-${id}`)).toHaveTextContent('Moderate similarity');
    }
  });

  it('renders a marked current snapshot with null max similarity as N/A', async () => {
    renderWithSnapshots([
      buildSnapshot(105, { scoring_contract: CURRENT_CONTRACT, max_similarity: null, overall_risk: null })
    ]);

    expect(await scoreCell(105)).toHaveTextContent(/^cosine N\/A$/);
  });

  it('renders an unmarked legacy value exactly as stored, without a percent sign, cosine label, or normalisation', async () => {
    const user = userEvent.setup();
    renderWithSnapshots([
      buildSnapshot(201, { max_similarity: 81.4, overall_risk: 'HIGH' })
    ]);

    const cell = await scoreCell(201);
    expect(cell).toHaveTextContent(/^81\.4$/);
    expect(cell).not.toHaveTextContent('%');
    expect(cell).not.toHaveTextContent('cosine');
    expect(cell).not.toHaveTextContent('0.814');

    // The stored classification stays labelled as recorded metadata.
    expect(screen.getByTestId('snapshot-recorded-classification-201')).toHaveTextContent(/recorded/i);

    // The contract-unknown caveat remains available through the row disclosure.
    await user.click(screen.getByTestId('register-toggle-201'));
    expect(screen.getByTestId('snapshot-contract-note-201')).toHaveTextContent(
      /historical scoring contract not recorded.*shown as stored.*not directly comparable/i
    );
  });

  it('does not present an unmarked stored zero as an asserted current cosine 0.000', async () => {
    renderWithSnapshots([
      buildSnapshot(202, { max_similarity: 0 })
    ]);

    const cell = await scoreCell(202);
    expect(cell).toHaveTextContent(/^0$/);
    expect(cell).not.toHaveTextContent('0.000');
    expect(cell).not.toHaveTextContent('cosine');
  });

  it('treats an unmarked voyage-like value as contract-unknown: marker presence, not numeric range, decides', async () => {
    renderWithSnapshots([
      buildSnapshot(203, { max_similarity: 0.623 })
    ]);

    const cell = await scoreCell(203);
    expect(cell).toHaveTextContent(/^0\.623$/);
    expect(cell).not.toHaveTextContent('cosine');
    expect(screen.getByTestId('snapshot-recorded-classification-203')).toBeInTheDocument();
  });

  it('renders an unknown-contract HIGH as a neutral recorded token with no verdict colour', async () => {
    renderWithSnapshots([
      buildSnapshot(210, { max_similarity: 81.4, overall_risk: 'HIGH' }),
      buildSnapshot(211, { scoring_contract: CURRENT_CONTRACT, max_similarity: 0.72, overall_risk: 'HIGH' })
    ]);

    const SEMANTIC_COLOUR = /red|rose|amber|yellow|orange|green|emerald|danger|success|warning/i;

    // Register row: "Recorded HIGH" — the stored raw token, resting neutral.
    // On a rejected record, red must mean the human decision, never a
    // historical similarity reading.
    const recorded = await screen.findByTestId('snapshot-recorded-classification-210');
    expect(recorded).toHaveTextContent('Recorded');
    expect(recorded).toHaveTextContent('HIGH');
    const recordedClasses = [recorded, ...recorded.querySelectorAll('*')].map((el) => el.className).join(' ');
    expect(recordedClasses).not.toMatch(SEMANTIC_COLOUR);

    // The stored token is never translated into the current plain-language
    // vocabulary — that would imply current thresholds were applied.
    expect(recorded).not.toHaveTextContent('Higher similarity');

    // Current-contract HIGH keeps the Board A neutral family unchanged.
    expect(screen.getByTestId('register-class-211')).toHaveTextContent('Higher similarity');

    // The latest-saved-check summary uses the same neutral treatment (the
    // newest fixture row is the unmarked one).
    const latest = screen.getByTestId('latest-recorded-classification');
    expect(latest).toHaveTextContent('HIGH');
    const latestClasses = [latest, ...latest.querySelectorAll('*')].map((el) => el.className).join(' ');
    expect(latestClasses).not.toMatch(SEMANTIC_COLOUR);
  });

  it('keeps marked and unmarked rows on their own presentations when mixed in one register', async () => {
    renderWithSnapshots([
      buildSnapshot(301, { scoring_contract: CURRENT_CONTRACT, max_similarity: 0.623 }),
      buildSnapshot(302, { max_similarity: 81.4 })
    ]);

    expect(await scoreCell(301)).toHaveTextContent(/^cosine 0\.623$/);
    expect(await scoreCell(302)).toHaveTextContent(/^81\.4$/);
    expect(screen.getByTestId('register-class-301')).toHaveTextContent('Moderate similarity');
    expect(screen.getByTestId('snapshot-recorded-classification-302')).toBeInTheDocument();
  });
});
