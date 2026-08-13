import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getSubmission: vi.fn(),
  listSnapshots: vi.fn(),
  clientPost: vi.fn()
}));

vi.mock('../src/api/submissions', () => ({
  getLecturerSubmission: mocks.getSubmission,
  listLecturerSubmissionSimilaritySnapshots: mocks.listSnapshots,
  updateLecturerSubmissionStatus: vi.fn()
}));
vi.mock('../src/api/client', () => ({ default: { post: mocks.clientPost } }));

import SubmissionDetailPage from '../src/pages/lecturer/SubmissionDetailPage';

const submission = {
  id: 42,
  title: 'Assessment of malaria prevention awareness among rural students',
  status: 'pending_review',
  category: 'Public Health',
  keywords: 'malaria, prevention',
  student_name: 'Ada Student',
  student_email: 'ada.student@uniosun.edu.ng',
  session_name: '2025/2026'
};

describe('SubmissionDetailPage semantic-unavailable transport contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSubmission.mockResolvedValue(submission);
    mocks.listSnapshots.mockResolvedValue([]);
  });

  it('renders the explicit unavailable state from a real Axios-shaped 503 rejection', async () => {
    const user = userEvent.setup();
    mocks.clientPost.mockRejectedValue({
      response: {
        status: 503,
        data: {
          status: 'semantic_unavailable',
          semanticAvailable: false,
          semanticProvider: 'voyage',
          semanticModel: 'voyage-4-large',
          message: 'Semantic analysis is currently unavailable.'
        }
      }
    });

    render(<MemoryRouter initialEntries={['/lecturer/pending-reviews/42']}><Routes><Route path="/lecturer/pending-reviews/:topicId" element={<SubmissionDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText(/assessment of malaria prevention awareness/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run similarity check/i }));

    expect(await screen.findByText(/semantic similarity unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/similarity check failed/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('results-display')).not.toBeInTheDocument();
    expect(screen.queryByText(/low risk|medium risk|high risk|exact match|term weighting|sbert|combined similarity/i)).not.toBeInTheDocument();
  });
});
