import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LecturerDashboardPage from '../src/pages/lecturer/DashboardPage';
import {
  listLecturerPendingSubmissions,
  listLecturerSubmissionSimilaritySnapshots,
  updateLecturerSubmissionStatus
} from '../src/api/submissions';
import { runLecturerSubmissionSimilarityCheck } from '../src/api/similarity';

vi.mock('../src/api/submissions', () => ({
  listLecturerPendingSubmissions: vi.fn(),
  listLecturerSubmissionSimilaritySnapshots: vi.fn(),
  updateLecturerSubmissionStatus: vi.fn()
}));

vi.mock('../src/api/similarity', () => ({
  runLecturerSubmissionSimilarityCheck: vi.fn()
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderLecturerDashboard() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/dashboard']}>
      <Routes>
        <Route path="/lecturer/dashboard" element={<LecturerDashboardPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LecturerDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls listLecturerPendingSubmissions and shows loading state', () => {
    listLecturerPendingSubmissions.mockReturnValue(new Promise(() => {}));
    renderLecturerDashboard();

    expect(screen.getByText(/loading lecturer dashboard/i)).toBeInTheDocument();
    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(1);
  });

  it('shows API error and retry', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions
      .mockRejectedValueOnce({
        response: { data: { message: 'Unable to reach lecturer queue.' } }
      })
      .mockResolvedValueOnce([]);
    renderLecturerDashboard();

    expect(await screen.findByText(/unable to reach lecturer queue/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/no pending reviews/i)).toBeInTheDocument();
    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(2);
  });

  it('shows fallback API error text', async () => {
    listLecturerPendingSubmissions.mockRejectedValue({});
    renderLecturerDashboard();

    expect(await screen.findByText(/unable to load lecturer dashboard/i)).toBeInTheDocument();
  });

  it('shows empty pending-review state', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderLecturerDashboard();

    expect(await screen.findByText(/no pending reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/student submissions with pending review status/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no pending reviews/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open pending reviews/i }));

    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/pending-reviews');
  });

  it('shows pending count from returned data and honest unavailable placeholders', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([
      { id: 1, title: 'First pending topic', status: 'pending_review' },
      { id: 2, title: 'Second pending topic', status: 'pending_review' }
    ]);
    renderLecturerDashboard();

    expect(await screen.findByText(/first pending topic/i)).toBeInTheDocument();
    expect(screen.getByText(/loaded from the existing pending review queue/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText(/not available yet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not connected yet/i).length).toBeGreaterThan(0);
  });

  it('renders compact pending review cards with safe returned fields', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([
      {
        id: 3,
        title: 'Assessment of community health education uptake',
        status: 'pending_review',
        category: 'Public Health',
        keywords: 'health, education',
        student_name: 'Ada Student',
        student_email: 'ada.student@uniosun.edu.ng',
        session_name: '2025/2026',
        submitted_at: '2026-05-20T10:00:00.000Z'
      }
    ]);
    renderLecturerDashboard();

    expect(await screen.findByText(/assessment of community health education uptake/i)).toBeInTheDocument();
    expect(screen.getByText(/public health/i)).toBeInTheDocument();
    expect(screen.getByText(/keywords: health, education/i)).toBeInTheDocument();
    expect(screen.getByText(/ada student/i)).toBeInTheDocument();
    expect(screen.getByText(/ada\.student@uniosun\.edu\.ng/i)).toBeInTheDocument();
    expect(screen.getByText(/2025\/2026/i)).toBeInTheDocument();
    expect(screen.getByText(/submitted may 20, 2026/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pending review/i).length).toBeGreaterThan(0);
  });

  it('links actions to existing lecturer routes', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([
      { id: 4, title: 'Pending route topic', status: 'pending_review' }
    ]);
    renderLecturerDashboard();

    expect(await screen.findByText(/pending route topic/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view details/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/pending-reviews/4');
  });

  it('links to pending reviews and check similarity routes', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderLecturerDashboard();

    expect(await screen.findByText(/no pending reviews/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /check similarity/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/check-similarity');

    renderLecturerDashboard();
    expect(await screen.findByText(/no pending reviews/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view all pending reviews/i }));
    expect(screen.getAllByTestId('location-display').at(-1)).toHaveTextContent('/lecturer/pending-reviews');
  });

  it('does not call status mutation, lecturer similarity, or snapshot helpers', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([
      { id: 5, title: 'Read only dashboard topic', status: 'pending_review' }
    ]);
    renderLecturerDashboard();

    expect(await screen.findByText(/read only dashboard topic/i)).toBeInTheDocument();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
    expect(runLecturerSubmissionSimilarityCheck).not.toHaveBeenCalled();
    expect(listLecturerSubmissionSimilaritySnapshots).not.toHaveBeenCalled();
  });

  it('does not expose fake risk scores, fake high-risk alerts, or fake activity', async () => {
    listLecturerPendingSubmissions.mockResolvedValue([
      {
        id: 6,
        title: 'Safe lecturer dashboard topic',
        status: 'pending_review',
        risk_level: 'HIGH',
        max_similarity: 94,
        activity: 'Approved two topics yesterday'
      }
    ]);
    renderLecturerDashboard();

    expect(await screen.findByText(/safe lecturer dashboard topic/i)).toBeInTheDocument();
    expect(screen.queryByText(/94/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approved two topics yesterday/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/critical high-risk submission/i)).not.toBeInTheDocument();
    expect(screen.getByText(/risk summaries are not connected/i)).toBeInTheDocument();
  });
});
