import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PendingReviewsPage from '../src/pages/lecturer/PendingReviewsPage';
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

const pendingSubmissions = [
  {
    id: 1,
    title: 'Assessment of malaria prevention awareness among rural students',
    status: 'pending_review',
    category: 'Public Health',
    keywords: 'malaria, prevention',
    student_name: 'Ada Student',
    student_email: 'ada.student@uniosun.edu.ng',
    session_name: '2025/2026',
    submitted_at: '2026-05-20T10:00:00.000Z',
    risk_level: 'HIGH',
    max_similarity: 91,
    assigned_reviewer: 'Dr. Hidden Reviewer',
    activity: 'Fake activity item'
  },
  {
    id: 2,
    title: 'Machine learning models for library resource recommendation',
    status: 'pending_review',
    category: 'Computer Science',
    keywords: 'machine learning, library',
    student_name: 'Bola Student',
    student_email: 'bola.student@uniosun.edu.ng',
    session_name: '2024/2025',
    submitted_at: '2026-05-22T08:00:00.000Z'
  }
];

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderPendingReviewsPage() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/pending-reviews']}>
      <Routes>
        <Route path="/lecturer/pending-reviews" element={<PendingReviewsPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Lecturer PendingReviewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls listLecturerPendingSubmissions and shows loading state', () => {
    listLecturerPendingSubmissions.mockReturnValue(new Promise(() => {}));
    renderPendingReviewsPage();

    expect(screen.getByText(/loading pending reviews/i)).toBeInTheDocument();
    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(1);
  });

  it('shows API error fallback and retry', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions
      .mockRejectedValueOnce({
        response: { data: { message: 'Lecturer queue unavailable.' } }
      })
      .mockResolvedValueOnce([]);
    renderPendingReviewsPage();

    expect(await screen.findByText(/lecturer queue unavailable/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/no pending reviews/i)).toBeInTheDocument();
    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(2);
  });

  it('shows default API error fallback text', async () => {
    listLecturerPendingSubmissions.mockRejectedValue({});
    renderPendingReviewsPage();

    expect(await screen.findByText(/unable to load pending reviews/i)).toBeInTheDocument();
  });

  it('shows empty pending-review state', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue([]);
    renderPendingReviewsPage();

    expect(await screen.findByText(/no pending reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/student submissions with pending review status/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /refresh queue/i }));

    expect(listLecturerPendingSubmissions).toHaveBeenCalledTimes(2);
  });

  it('renders returned safe fields in the queue', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.getAllByText(/public health/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/keywords: malaria, prevention/i)).toBeInTheDocument();
    expect(screen.getByText(/ada student/i)).toBeInTheDocument();
    expect(screen.getByText(/ada\.student@uniosun\.edu\.ng/i)).toBeInTheDocument();
    expect(screen.getByText(/2025\/2026/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pending review/i).length).toBeGreaterThan(0);
  });

  it('links each row to the existing submission detail route', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /open review/i })[1]);

    expect(screen.getByTestId('location-display')).toHaveTextContent('/lecturer/pending-reviews/2');
  });

  it('supports client-side search', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'library');

    expect(screen.queryByText(/assessment of malaria prevention awareness/i)).not.toBeInTheDocument();
    expect(screen.getByText(/machine learning models for library/i)).toBeInTheDocument();
  });

  it('supports client-side category filter', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Computer Science');

    expect(screen.queryByText(/assessment of malaria prevention awareness/i)).not.toBeInTheDocument();
    expect(screen.getByText(/machine learning models for library/i)).toBeInTheDocument();
  });

  it('supports client-side oldest and newest sort', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    expect(document.body.textContent.indexOf('Assessment of malaria')).toBeLessThan(
      document.body.textContent.indexOf('Machine learning models')
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'newest');

    expect(document.body.textContent.indexOf('Machine learning models')).toBeLessThan(
      document.body.textContent.indexOf('Assessment of malaria')
    );
  });

  it('shows no-results state for search and filter mismatch', async () => {
    const user = userEvent.setup();
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search queue/i }), 'nothing matches this');

    expect(screen.getByText(/no matching pending reviews/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(screen.getByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
  });

  it('does not call queue mutation, lecturer similarity, or snapshot helpers', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
    expect(runLecturerSubmissionSimilarityCheck).not.toHaveBeenCalled();
    expect(listLecturerSubmissionSimilaritySnapshots).not.toHaveBeenCalled();
  });

  it('does not show approve, request revision, or reject queue action buttons', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject in detail/i })).not.toBeInTheDocument();
  });

  it('does not expose fake risk scores, alerts, assignments, pagination, or activity', async () => {
    listLecturerPendingSubmissions.mockResolvedValue(pendingSubmissions);
    renderPendingReviewsPage();

    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();
    expect(screen.queryByText(/91/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/high-risk alert/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dr\. hidden reviewer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fake activity item/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/risk labels/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score summaries/i)).not.toBeInTheDocument();
  });
});
