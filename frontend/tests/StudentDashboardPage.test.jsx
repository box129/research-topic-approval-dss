import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import StudentDashboardPage from '../src/pages/student/DashboardPage';
import { listSubmissions } from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  listSubmissions: vi.fn()
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/student/dashboard']}>
      <Routes>
        <Route path="/student/dashboard" element={<StudentDashboardPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('StudentDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while submissions load', () => {
    listSubmissions.mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(screen.getByText(/loading student dashboard/i)).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledTimes(1);
  });

  it('shows empty onboarding state when no submissions exist', async () => {
    const user = userEvent.setup();
    listSubmissions.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByText(/no topic submitted yet/i)).toBeInTheDocument();
    expect(screen.getByText(/similarity score, reviewer assignment, notifications/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check my topic/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /submit topic/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/submit-topic');
  });

  it('shows pending review dashboard state', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Knowledge of malaria prevention among children under five',
        status: 'pending_review',
        category: 'Public Health',
        submitted_at: '2026-05-01T10:00:00.000Z'
      }
    ]);
    renderDashboard();

    expect(await screen.findByText(/knowledge of malaria prevention/i)).toBeInTheDocument();
    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
    expect(screen.getByText(/lecturer review is pending/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view my submissions/i })).toBeInTheDocument();
  });

  it('shows awaiting revision state with lecturer feedback', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Assessment of sanitation practice in public schools',
        status: 'awaiting_revision',
        decision_reason: 'Narrow the topic scope before resubmission.',
        decided_at: '2026-05-04T12:00:00.000Z',
        submitted_at: '2026-05-02T10:00:00.000Z'
      }
    ]);
    renderDashboard();

    expect(await screen.findByText(/awaiting revision/i)).toBeInTheDocument();
    expect(screen.getByText(/narrow the topic scope before resubmission/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review feedback/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^submit topic$/i })).toBeInTheDocument();
  });

  it('shows approved state with positive next-step guidance', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Evaluation of antenatal care uptake in Osun State',
        status: 'approved',
        decided_at: '2026-05-05T12:00:00.000Z',
        submitted_at: '2026-05-03T10:00:00.000Z'
      }
    ]);
    renderDashboard();

    expect(await screen.findByText(/topic approved/i)).toBeInTheDocument();
    expect(screen.getByText(/you can continue with the next academic steps/i)).toBeInTheDocument();
    expect(screen.getByText(/similarity score/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not available yet/i).length).toBeGreaterThan(0);
  });

  it('shows rejected state gracefully', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Rejected sample topic',
        status: 'rejected',
        decision_reason: 'This topic overlaps too much with prior work.',
        decided_at: '2026-05-05T12:00:00.000Z',
        submitted_at: '2026-05-04T12:00:00.000Z'
      }
    ]);
    renderDashboard();

    expect(await screen.findByText(/topic rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/this topic overlaps too much with prior work/i)).toBeInTheDocument();
    expect(screen.getAllByText(/rejected/i).length).toBeGreaterThan(0);
  });

  it('shows unknown states gracefully', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Rejected sample topic',
        status: 'rejected',
        decision_reason: 'This topic overlaps too much with prior work.',
        decided_at: '2026-05-05T12:00:00.000Z'
      },
      {
        id: 2,
        title: 'Unknown sample topic',
        status: 'department_hold',
        created_at: '2026-05-06T12:00:00.000Z'
      }
    ]);
    renderDashboard();

    expect(await screen.findByText(/unknown sample topic/i)).toBeInTheDocument();
    expect(screen.getByText(/department hold/i)).toBeInTheDocument();
    expect(screen.getByText(/submission status available/i)).toBeInTheDocument();
  });

  it('calls listSubmissions and does not expose unsupported similarity snapshots or lecturer identity', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Safe dashboard topic',
        status: 'pending_review',
        reviewer_name: 'Dr. Hidden Reviewer',
        submitted_at: '2026-05-01T10:00:00.000Z'
      }
    ]);
    renderDashboard();

    expect(await screen.findByText(/safe dashboard topic/i)).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dr\. hidden reviewer/i)).not.toBeInTheDocument();
  });
});
