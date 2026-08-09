import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  it('shows an error and retries the real submissions request', async () => {
    const user = userEvent.setup();
    listSubmissions
      .mockRejectedValueOnce({ response: { data: { message: 'Unable to reach submissions service.' } } })
      .mockResolvedValueOnce([]);
    renderDashboard();

    expect(await screen.findByText(/unable to reach submissions service/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/no topic submitted yet/i)).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledTimes(2);
  });

  it('shows an honest empty state with supported actions', async () => {
    const user = userEvent.setup();
    listSubmissions.mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByText(/no topic submitted yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check my topic/i })).toBeInTheDocument();
    expect(screen.queryByText(/similarity score|reviewer assignment|recent activity/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /submit topic/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/submit-topic');
  });

  it('selects the latest record and derives the summary from all returned submissions', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Older approved topic record',
        status: 'approved',
        submitted_at: '2026-05-01T10:00:00.000Z'
      },
      {
        id: 2,
        title: 'Latest pending topic record',
        status: 'pending_review',
        category: 'Public Health',
        submitted_at: '2026-05-03T10:00:00.000Z'
      },
      {
        id: 3,
        title: 'Earlier revision topic record',
        status: 'awaiting_revision',
        submitted_at: '2026-05-02T10:00:00.000Z'
      }
    ]);
    renderDashboard();

    expect(await screen.findByText(/latest pending topic record/i)).toBeInTheDocument();
    expect(screen.queryByText(/older approved topic record/i)).not.toBeInTheDocument();
    const summary = screen.getByLabelText(/submission summary/i);
    expect(within(summary).getByText('3')).toBeInTheDocument();
    expect(within(summary).getAllByText('1')).toHaveLength(3);
  });

  it('shows pending review guidance', async () => {
    listSubmissions.mockResolvedValue([{
      id: 1,
      title: 'Knowledge of malaria prevention among children under five',
      status: 'pending_review',
      submitted_at: '2026-05-01T10:00:00.000Z'
    }]);
    renderDashboard();

    expect(await screen.findByText(/knowledge of malaria prevention/i)).toBeInTheDocument();
    expect(screen.getByText(/lecturer review is pending/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view my submissions/i })).toBeInTheDocument();
  });

  it('shows revision feedback and routes new work to Submit Topic', async () => {
    const user = userEvent.setup();
    listSubmissions.mockResolvedValue([{
      id: 1,
      title: 'Assessment of sanitation practice in public schools',
      status: 'awaiting_revision',
      decision_reason: 'Narrow the topic scope before resubmission.',
      submitted_at: '2026-05-02T10:00:00.000Z'
    }]);
    const firstRender = renderDashboard();

    expect(await screen.findByText(/narrow the topic scope before resubmission/i)).toBeInTheDocument();
    expect(screen.getByText('Review the feedback above, then submit a revised topic for lecturer review.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review feedback/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit topic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View my submissions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check another topic' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit topic' }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/submit-topic');
    firstRender.unmount();

    const secondRender = renderDashboard();
    await screen.findByRole('button', { name: 'View my submissions' });
    await user.click(screen.getByRole('button', { name: 'View my submissions' }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/my-submissions');
    secondRender.unmount();

    renderDashboard();
    await screen.findByRole('button', { name: 'Check another topic' });
    await user.click(screen.getByRole('button', { name: 'Check another topic' }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/check-my-topic');
  });

  it.each([
    ['approved', /topic approved/i, /next academic steps/i],
    ['rejected', /topic rejected/i, /review the feedback/i]
  ])('shows truthful %s guidance', async (status, title, message) => {
    listSubmissions.mockResolvedValue([{
      id: 1,
      title: `${status} student topic record`,
      status,
      submitted_at: '2026-05-03T10:00:00.000Z'
    }]);
    renderDashboard();

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText(/similarity score|approval probability|review estimate/i)).not.toBeInTheDocument();
  });

  it('renders an unknown status neutrally', async () => {
    listSubmissions.mockResolvedValue([{
      id: 1,
      title: 'Unknown status student topic',
      status: 'department_hold',
      created_at: '2026-05-06T12:00:00.000Z'
    }]);
    renderDashboard();

    expect(await screen.findByText(/unknown status student topic/i)).toBeInTheDocument();
    expect(screen.getByText(/department hold/i)).toHaveClass('bg-status-neutral-bg');
    expect(screen.getByText(/submission status available/i)).toBeInTheDocument();
  });

  it('does not expose private or unsupported response fields', async () => {
    listSubmissions.mockResolvedValue([{
      id: 1,
      title: 'Safe dashboard topic',
      status: 'pending_review',
      reviewer_name: 'Dr. Hidden Reviewer',
      similarity_summary: 'Hidden similarity snapshot',
      submitted_at: '2026-05-01T10:00:00.000Z'
    }]);
    renderDashboard();

    expect(await screen.findByText(/safe dashboard topic/i)).toBeInTheDocument();
    expect(screen.queryByText(/dr\. hidden reviewer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden similarity snapshot/i)).not.toBeInTheDocument();
  });
});
