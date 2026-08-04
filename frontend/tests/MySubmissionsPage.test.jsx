import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MySubmissionsPage from '../src/pages/student/MySubmissionsPage';
import { listSubmissions } from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  listSubmissions: vi.fn()
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderMySubmissionsPage() {
  return render(
    <MemoryRouter initialEntries={['/student/my-submissions']}>
      <Routes>
        <Route path="/student/my-submissions" element={<MySubmissionsPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MySubmissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls listSubmissions', async () => {
    listSubmissions.mockResolvedValue([]);
    renderMySubmissionsPage();

    await screen.findByText(/no submissions yet/i);

    expect(listSubmissions).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while submissions load', () => {
    listSubmissions.mockReturnValue(new Promise(() => {}));
    renderMySubmissionsPage();

    expect(screen.getByText(/loading submissions/i)).toBeInTheDocument();
  });

  it('shows empty state and submit-topic CTA', async () => {
    const user = userEvent.setup();
    listSubmissions.mockResolvedValue([]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /submit topic/i })[0]);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/submit-topic');
  });

  it('shows pending review without feedback', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Assessing digital library access among undergraduate students',
        status: 'pending_review',
        category: 'Education',
        keywords: 'library, students',
        submitted_at: '2026-05-20T10:00:00.000Z'
      }
    ]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/assessing digital library access/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pending review/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/your submission is waiting for a lecturer decision/i)).toBeInTheDocument();
    expect(screen.queryByText(/decision feedback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no additional comment was provided/i)).not.toBeInTheDocument();
  });

  it('shows awaiting revision with decision_reason and decided_at', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 2,
        title: 'Sanitation practice assessment in public secondary schools',
        status: 'awaiting_revision',
        decision_reason: 'Narrow the study population before resubmission.',
        decided_at: '2026-05-22T13:30:00.000Z',
        submitted_at: '2026-05-18T09:00:00.000Z'
      }
    ]);
    renderMySubmissionsPage();

    expect((await screen.findAllByText(/awaiting revision/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/narrow the study population before resubmission/i)).toBeInTheDocument();
    expect(screen.getByText(/decision recorded/i)).toHaveTextContent(/may 22, 2026/i);
  });

  it('shows approved state', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 3,
        title: 'Evaluation of antenatal care uptake in Osun State',
        status: 'approved',
        decided_at: '2026-05-21T10:00:00.000Z',
        submitted_at: '2026-05-19T10:00:00.000Z'
      }
    ]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/evaluation of antenatal care uptake/i)).toBeInTheDocument();
    expect(screen.getAllByText(/approved/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/this submission has been approved/i)).toBeInTheDocument();
    expect(screen.getByText(/no additional comment was provided/i)).toBeInTheDocument();
  });

  it('shows rejected state gracefully', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 4,
        title: 'Rejected sample student topic',
        status: 'rejected',
        decision_reason: 'This topic needs a new research direction.',
        decided_at: '2026-05-23T08:00:00.000Z'
      }
    ]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/rejected sample student topic/i)).toBeInTheDocument();
    expect(screen.getAllByText(/rejected/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/not approved/i)).toBeInTheDocument();
    expect(screen.getByText(/this topic needs a new research direction/i)).toBeInTheDocument();
  });

  it('handles unknown custom status', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 5,
        title: 'Custom status student topic',
        status: 'department_hold',
        created_at: '2026-05-24T08:00:00.000Z'
      }
    ]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/custom status student topic/i)).toBeInTheDocument();
    expect(screen.getByText(/department hold/i)).toBeInTheDocument();
    expect(screen.getByText(/submission status available/i)).toBeInTheDocument();
  });

  it('shows API error and retry', async () => {
    const user = userEvent.setup();
    listSubmissions
      .mockRejectedValueOnce({
        response: { data: { message: 'Unable to reach submissions service.' } }
      })
      .mockResolvedValueOnce([]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/unable to reach submissions service/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledTimes(2);
  });

  it('does not expose lecturer identity, decided-by fields, snapshots, or summaries', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 6,
        title: 'Safe feedback display topic',
        status: 'awaiting_revision',
        decision_reason: 'Please tighten the title scope.',
        decided_at: '2026-05-22T13:30:00.000Z',
        decided_by_id: '9999',
        decided_by_name: 'Dr. Hidden Reviewer',
        reviewer_name: 'Prof. Private Marker',
        lecturer_name: 'Dr. Private Lecturer',
        similarity_snapshots: [{ note: 'Hidden snapshot content' }],
        similarity_summary: 'Hidden summary content',
        result_summary: { note: 'Hidden result summary' }
      }
    ]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/safe feedback display topic/i)).toBeInTheDocument();
    expect(screen.getByText(/please tighten the title scope/i)).toBeInTheDocument();
    expect(screen.queryByText(/9999/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dr\. hidden reviewer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prof\. private marker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dr\. private lecturer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden snapshot content/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden summary content/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden result summary/i)).not.toBeInTheDocument();
  });
});
