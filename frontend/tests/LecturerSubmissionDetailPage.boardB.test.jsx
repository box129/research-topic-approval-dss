import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  title: 'Influence of Public Health Campaigns on Student Malaria Prevention Practices',
  status: 'pending_review',
  category: 'Public Health',
  keywords: 'public health campaigns, malaria prevention, students',
  student_name: 'Student Demo User',
  student_email: 'student.demo@uniosun.edu.ng',
  session_name: null,
  submitted_at: '2026-05-20T16:28:00.000Z'
};

const rejectedSubmission = {
  ...pendingSubmission,
  title: 'Assessment of Health Awareness Campaigns on Student Malaria Prevention Practices',
  status: 'rejected',
  decision_reason: 'This topic is too similar to an existing malaria prevention topic and needs refinement.',
  decided_by_name: 'Lecturer Demo User',
  decided_at: '2026-05-23T17:43:00.000Z'
};

function buildSnapshot(id, overrides = {}) {
  return {
    id,
    overall_risk: 'HIGH',
    response_status: 'success',
    checked_by: { name: 'Lecturer Demo User', email: 'lecturer.demo@uniosun.edu.ng' },
    created_at: '2026-05-22T19:16:00.000Z',
    max_similarity: 81.4,
    result_summary: { tierCounts: { historical: 5, currentSession: 1, underReview: 2 } },
    recommendation: 'High similarity detected.',
    ...overrides
  };
}

function buildFreshCheckResponse() {
  return {
    status: 'success',
    message: '',
    results: {
      risk_level: 'MEDIUM',
      max_similarity: 0.623,
      corpus_size: 9,
      semantic_available: true,
      tier1_matches: [
        {
          id: 1,
          topic_title: 'Assessment of Health Education Campaigns on Malaria Prevention',
          supervisor_name: 'Dr. Adeyemi',
          session_year: '2022/2023',
          collection: 'HISTORICAL',
          semantic_score: 0.623,
          similarity_class: 'MEDIUM'
        }
      ],
      tier2_matches: [],
      tier3_matches: []
    }
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/pending-reviews/42']}>
      <Routes>
        <Route path="/lecturer/pending-reviews/:topicId" element={<SubmissionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function expectBefore(firstTestId, secondTestId) {
  const first = screen.getByTestId(firstTestId);
  const second = screen.getByTestId(secondTestId);
  // DOCUMENT_POSITION_FOLLOWING = 4: `second` comes after `first`.
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

const FORBIDDEN_LINKAGE = /before the decision|used for this decision|evidence considered|on file at the time|decision snapshot|linked to (the )?decision/i;

describe('Board B — pending (B1) composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders identity → context → evidence → history → decision, in order', async () => {
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([buildSnapshot(7)]);
    renderPage();

    expect(await screen.findByTestId('identity-header')).toBeInTheDocument();
    expectBefore('identity-header', 'proposal-context');
    expectBefore('proposal-context', 'evidence-section');
    expectBefore('evidence-section', 'history-section');
    expectBefore('history-section', 'decision-section');
    expect(screen.queryByTestId('recorded-decision')).not.toBeInTheDocument();

    // The advisory boundary sits in the pending identity header.
    expect(within(screen.getByTestId('identity-header')).getByText(
      'Similarity evidence is advisory. Final decisions remain lecturer-controlled.'
    )).toBeInTheDocument();
  });

  it('shows the latest saved check with its own recorded-by provenance and an in-section run action', async () => {
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([
      buildSnapshot(7, { scoring_contract: 'voyage-raw-cosine-v1', max_similarity: 0.623, overall_risk: 'MEDIUM' })
    ]);
    renderPage();

    const latest = await screen.findByTestId('latest-saved-check');
    expect(latest).toHaveTextContent(/latest saved similarity check · recorded .* · by lecturer demo user/i);
    expect(latest).toHaveTextContent('cosine 0.623');

    const runButton = screen.getByTestId('run-new-check');
    expect(runButton).toBeEnabled();
    expect(screen.getByText(/records additional advisory evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/does not change the submission status or alter the recorded lecturer decision/i)).toBeInTheDocument();
  });

  it('keeps the pending register behind a keyboard-operable disclosure', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([buildSnapshot(7)]);
    renderPage();

    expect(await screen.findByTestId('history-summary')).toHaveTextContent('1 saved check');
    expect(screen.queryByTestId('history-register')).not.toBeInTheDocument();

    const toggle = screen.getByTestId('show-register');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('history-register')).toBeInTheDocument();
    expect(screen.getByTestId('show-register')).toHaveAttribute('aria-expanded', 'true');
  });

  it('enforces the rationale contract: approve optional, revision and reject required at 10+ characters', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('decision-section')).toBeInTheDocument();
    expect(screen.getByTestId('rationale-rules')).toHaveTextContent(
      'Approve — rationale optional · Request Revision — rationale required · Reject — rationale required'
    );

    // Approve without a rationale opens the confirmation modal — optional.
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));

    // Request Revision without a rationale is blocked with focus returned.
    await user.click(screen.getByRole('button', { name: /request revision/i }));
    expect(screen.getByText(/revision feedback is required/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/decision rationale/i)).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // A too-short rationale is blocked for reject.
    await user.type(screen.getByLabelText(/decision rationale/i), 'too short');
    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
  });

  it('confirms Request Revision with amber revision semantics, reject with danger, approve with the default', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('decision-section')).toBeInTheDocument();
    const rationale = screen.getByLabelText(/decision rationale/i);

    // Request Revision → amber confirm, never approve-green.
    await user.type(rationale, 'Please narrow the research scope.');
    await user.click(screen.getByRole('button', { name: /request revision/i }));
    let confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: /request revision/i });
    // The amber variant carries the important modifier, which is what makes it
    // beat PrimaryButton's base approve-green regardless of stylesheet order.
    expect(confirmButton.className).toMatch(/bg-brand-gold-dark!/);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));

    // Reject → danger confirm.
    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: /^reject$/i });
    expect(confirmButton.className).toMatch(/feedback-danger/);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));

    // Approve → unchanged default approval treatment.
    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    confirmButton = within(screen.getByRole('dialog')).getByRole('button', { name: /^approve$/i });
    expect(confirmButton.className).toMatch(/brand-green/);
  });

  it('stacks the three decision actions full-width at a 44px minimum', async () => {
    getLecturerSubmission.mockResolvedValue(pendingSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('decision-section')).toBeInTheDocument();
    const buttons = [
      screen.getByRole('button', { name: /^approve$/i }),
      screen.getByRole('button', { name: /request revision/i }),
      screen.getByRole('button', { name: /^reject$/i })
    ];

    for (const button of buttons) {
      expect(button.className).toMatch(/min-h-11/);
      expect(button.className).toMatch(/w-full/);
    }
    expect(buttons[0].parentElement.className).toMatch(/flex-col/);
    expect(buttons[0].parentElement.className).toMatch(/sm:flex-row/);
  });
});

describe('Board B — terminal (B2) composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders identity → recorded decision → context → evidence → history, with the decision before all evidence', async () => {
    getLecturerSubmission.mockResolvedValue(rejectedSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([buildSnapshot(7)]);
    renderPage();

    expect(await screen.findByTestId('recorded-decision')).toBeInTheDocument();
    expectBefore('identity-header', 'recorded-decision');
    expectBefore('recorded-decision', 'proposal-context');
    expectBefore('proposal-context', 'evidence-section');
    expectBefore('evidence-section', 'history-section');
    expectBefore('recorded-decision', 'evidence-section');
    expect(screen.queryByTestId('decision-section')).not.toBeInTheDocument();
  });

  it('presents the persisted decision with independent timestamps and no snapshot linkage language', async () => {
    getLecturerSubmission.mockResolvedValue(rejectedSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([
      buildSnapshot(7, { created_at: '2026-05-22T19:16:00.000Z' })
    ]);
    const { container } = renderPage();

    const decision = await screen.findByTestId('recorded-decision');
    expect(within(decision).getByTestId('decision-outcome')).toHaveTextContent('Rejected');
    expect(within(decision).getByTestId('decision-meta')).toHaveTextContent(/by lecturer demo user on may 23, 2026/i);
    expect(within(decision).getByTestId('decision-rationale-text')).toHaveTextContent(/too similar to an existing malaria prevention topic/i);
    expect(within(decision).getByTestId('terminal-note')).toHaveTextContent(
      'This submission is no longer pending review, so no further decision can be recorded here.'
    );

    // The latest saved check carries its own, different timestamp.
    const latest = screen.getByTestId('latest-saved-check');
    expect(latest).toHaveTextContent(/latest saved similarity check/i);
    expect(latest).toHaveTextContent(/may 22, 2026/i);

    expect(container.textContent).not.toMatch(FORBIDDEN_LINKAGE);
    // No reopen/amend control exists.
    expect(screen.queryByText(/reopen|amend|change decision|return to pending/i)).not.toBeInTheDocument();
  });

  it.each([
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['awaiting_revision', 'Revision requested']
  ])('keeps Run a new check available on a %s record while decision controls stay absent', async (status, outcomeLabel) => {
    getLecturerSubmission.mockResolvedValue({
      ...rejectedSubmission,
      status,
      decision_reason: 'Recorded rationale for this decision.',
      decided_by_name: 'Lecturer Demo User'
    });
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('decision-outcome')).toHaveTextContent(outcomeLabel);
    expect(screen.getByTestId('run-new-check')).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });

  it('runs a post-decision check that renders Board A output, refreshes history, and leaves the decision unchanged', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(rejectedSubmission);
    listLecturerSubmissionSimilaritySnapshots
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSnapshot(11, { scoring_contract: 'voyage-raw-cosine-v1', max_similarity: 0.623, overall_risk: 'MEDIUM' })]);
    runLecturerSubmissionSimilarityCheck.mockResolvedValue(buildFreshCheckResponse());
    renderPage();

    expect(await screen.findByTestId('recorded-decision')).toBeInTheDocument();

    await user.click(screen.getByTestId('run-new-check'));

    expect(await screen.findByTestId('results-display')).toBeInTheDocument();
    // Board A renders unchanged inside the lecturer evidence section.
    expect(screen.getByTestId('similarity-classification')).toHaveTextContent('Moderate similarity');
    expect(runLecturerSubmissionSimilarityCheck).toHaveBeenCalledWith(42);
    expect(listLecturerSubmissionSimilaritySnapshots).toHaveBeenCalledTimes(2);
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId('decision-outcome')).toHaveTextContent('Rejected');
  });

  it('shows a truthful quiet absence when an approved record has no recorded rationale', async () => {
    getLecturerSubmission.mockResolvedValue({
      ...rejectedSubmission,
      status: 'approved',
      decision_reason: null
    });
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByTestId('decision-outcome')).toHaveTextContent('Approved');
    expect(screen.getByTestId('decision-rationale-text')).toHaveTextContent('No rationale was recorded.');
  });

  it('offers the mobile context disclosure with every field reachable and no anywhere-wrapping', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(rejectedSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([]);
    const { container } = renderPage();

    expect(await screen.findByTestId('proposal-context')).toBeInTheDocument();

    // Secondary fields defer behind the disclosure on narrow terminal
    // viewports (the `hidden sm:block` mechanism); expansion removes the
    // deferral so every field is reachable. Nothing is deleted.
    const keywordsField = screen.getByTestId('context-field-keywords');
    expect(keywordsField.className).toMatch(/hidden sm:block/);

    const toggle = screen.getByTestId('show-context-fields');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByTestId('context-field-keywords').className).not.toMatch(/hidden/);
    expect(screen.getByTestId('show-context-fields')).toHaveAttribute('aria-expanded', 'true');

    // Email gets room and break-word as a last resort — never anywhere-wrap.
    const emailField = screen.getByTestId('context-field-personal-email');
    expect(emailField).toHaveTextContent('student.demo@uniosun.edu.ng');
    expect(container.innerHTML).not.toMatch(/anywhere/);
  });
});

describe('Board B — history register truthfulness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps duplicate-looking snapshots as separate register rows (F-2)', async () => {
    getLecturerSubmission.mockResolvedValue(rejectedSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([
      buildSnapshot(31),
      buildSnapshot(32),
      buildSnapshot(33),
      buildSnapshot(34)
    ]);
    renderPage();

    expect(await screen.findByTestId('history-register')).toBeInTheDocument();
    expect(screen.getByTestId('register-row-31')).toBeInTheDocument();
    expect(screen.getByTestId('register-row-32')).toBeInTheDocument();
    expect(screen.getByTestId('register-row-33')).toBeInTheDocument();
    expect(screen.getByTestId('register-row-34')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^register-row-/)).toHaveLength(4);
    expect(screen.getByTestId('history-summary')).toHaveTextContent('4 saved checks');
    expect(screen.getByTestId('history-listing-note')).toHaveTextContent('Every saved check shown here is listed separately.');
  });

  it('uses completeness-safe wording when the endpoint cap of 10 rows is hit', async () => {
    getLecturerSubmission.mockResolvedValue(rejectedSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => buildSnapshot(50 + index))
    );
    const { container } = renderPage();

    expect(await screen.findByTestId('history-summary')).toHaveTextContent('Latest 10 saved checks');
    expect(screen.getByTestId('history-listing-note')).toHaveTextContent('Every loaded check is listed separately.');
    expect(container.textContent).not.toMatch(/10 total|all recorded checks|every recorded check/i);
    expect(screen.getAllByTestId(/^register-row-/)).toHaveLength(10);
  });

  it('keeps every current snapshot field reachable through the row disclosure', async () => {
    const user = userEvent.setup();
    getLecturerSubmission.mockResolvedValue(rejectedSubmission);
    listLecturerSubmissionSimilaritySnapshots.mockResolvedValue([buildSnapshot(61)]);
    renderPage();

    expect(await screen.findByTestId('register-row-61')).toBeInTheDocument();

    await user.click(screen.getByTestId('register-toggle-61'));
    const details = screen.getByTestId('register-details-61');
    expect(within(details).getByText(/response status/i)).toBeInTheDocument();
    expect(within(details).getByText(/^success$/i)).toBeInTheDocument();
    expect(within(details).getByText(/high similarity detected/i)).toBeInTheDocument();
    expect(within(details).getAllByText(/lecturer\.demo@uniosun\.edu\.ng/i).length).toBeGreaterThan(0);
    expect(within(details).getAllByText(/corpus tiers/i).length).toBeGreaterThan(0);
  });
});
