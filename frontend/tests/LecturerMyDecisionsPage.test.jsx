import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MyDecisionsPage from '../src/pages/lecturer/MyDecisionsPage';
import {
  listLecturerDecisions,
  listLecturerPendingSubmissions,
  updateLecturerSubmissionStatus
} from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  listLecturerDecisions: vi.fn(),
  listLecturerPendingSubmissions: vi.fn(),
  updateLecturerSubmissionStatus: vi.fn()
}));

const decisionsResponse = {
  data: {
    items: [
      {
        id: 11,
        title: 'Knowledge of malaria prevention among undergraduate public health students',
        studentName: 'Ada Student',
        studentMatricNumber: 'PHS/22/0042',
        studentEmail: 'ada.student@uniosun.edu.ng',
        category: 'Public Health',
        status: 'APPROVED',
        submittedAt: '2026-05-19T10:00:00.000Z',
        decidedAt: '2026-05-22T10:00:00.000Z',
        decisionFeedback: 'Approved after review.',
        similaritySnapshotId: 88,
        fakeRiskScore: 99,
        passwordHash: 'hidden'
      }
    ]
  },
  meta: {
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    filters: {},
    generatedAt: '2026-06-07T09:00:00.000Z',
    dataCoverage: 'Read-only lecturer decision history from existing submissions.'
  }
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/my-decisions']}>
      <MyDecisionsPage />
    </MemoryRouter>
  );
}

describe('Lecturer MyDecisionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLecturerDecisions.mockResolvedValue(decisionsResponse);
  });

  it('calls decision history API and shows loading state', () => {
    listLecturerDecisions.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/loading decision history/i)).toBeInTheDocument();
    expect(listLecturerDecisions).toHaveBeenCalledWith({
      direction: 'desc',
      limit: 10,
      page: 1,
      sort: 'decidedAt'
    });
  });

  it('renders real decision rows from the endpoint without sensitive or fake fields', async () => {
    renderPage();

    expect(await screen.findByText(/knowledge of malaria prevention/i)).toBeInTheDocument();
    expect(screen.getByText(/ada student/i)).toBeInTheDocument();
    expect(screen.getByText(/ada\.student@uniosun\.edu\.ng/i)).toBeInTheDocument();
    expect(screen.getByText(/approved after review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/approved/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Snapshot #88/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/passwordHash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hidden/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/99/i)).not.toBeInTheDocument();
  });

  it('identifies a student who has no email by matric number', async () => {
    listLecturerDecisions.mockResolvedValue({
      ...decisionsResponse,
      data: { items: [{ ...decisionsResponse.data.items[0], studentEmail: null }] }
    });
    renderPage();

    expect(await screen.findByTestId('decision-11-student-matric')).toHaveTextContent('PHS/22/0042');
    expect(screen.getByTestId('decision-11-student-name')).toHaveTextContent('Ada Student');
    expect(screen.queryByTestId('decision-11-student-email')).not.toBeInTheDocument();
    // A normal no-email student must never be rendered as a deficient record.
    expect(screen.queryByText(/no email available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/email unavailable/i)).not.toBeInTheDocument();
  });

  it('shows the email only as secondary detail after the matric number', async () => {
    listLecturerDecisions.mockResolvedValue({
      ...decisionsResponse,
      data: { items: [{ ...decisionsResponse.data.items[0], studentEmail: 'personal.address@example.com' }] }
    });
    renderPage();

    const matric = await screen.findByTestId('decision-11-student-matric');
    const email = screen.getByTestId('decision-11-student-email');
    expect(email).toHaveTextContent('personal.address@example.com');
    expect(Boolean(matric.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.queryByText(/no email available/i)).not.toBeInTheDocument();
  });

  it('offers the matric number as a search field', async () => {
    renderPage();

    expect(await screen.findByPlaceholderText(/matric number/i)).toBeInTheDocument();
  });

  it('passes supported filters and sorting to the endpoint', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/knowledge of malaria prevention/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: /search decisions/i }), {
      target: { name: 'search', value: 'malaria' }
    });
    await user.selectOptions(await screen.findByRole('combobox', { name: /status/i }), 'approved');
    fireEvent.change(await screen.findByRole('searchbox', { name: /category/i }), {
      target: { name: 'category', value: 'Public Health' }
    });
    await user.selectOptions(await screen.findByRole('combobox', { name: /sort/i }), 'submittedAt');
    await user.selectOptions(await screen.findByRole('combobox', { name: /direction/i }), 'asc');

    await waitFor(() => {
      expect(listLecturerDecisions).toHaveBeenLastCalledWith({
        category: 'Public Health',
        direction: 'asc',
        limit: 10,
        page: 1,
        search: 'malaria',
        sort: 'submittedAt',
        status: 'approved'
      });
    });
  });

  it('shows an honest empty state when no decisions are returned', async () => {
    listLecturerDecisions.mockResolvedValue({
      data: { items: [] },
      meta: {
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        },
        filters: {},
        dataCoverage: 'Read-only lecturer decision history from existing submissions.'
      }
    });

    renderPage();

    expect(await screen.findByText(/No decisions returned/i)).toBeInTheDocument();
    expect(screen.getByText(/No completed decisions match the current filters/i)).toBeInTheDocument();
  });

  it('shows unavailable state when the endpoint fails', async () => {
    listLecturerDecisions.mockRejectedValue({
      response: {
        data: {
          message: 'Decision history unavailable.'
        }
      }
    });

    renderPage();

    expect(await screen.findByText(/could not load decision history/i)).toBeInTheDocument();
    expect(screen.getByText(/decision history unavailable/i)).toBeInTheDocument();
  });

  it('does not expose unsupported decision export, report, or mutation actions', async () => {
    renderPage();

    expect(await screen.findByText(/knowledge of malaria prevention/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request revision/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download report/i })).not.toBeInTheDocument();
    expect(listLecturerPendingSubmissions).not.toHaveBeenCalled();
    expect(updateLecturerSubmissionStatus).not.toHaveBeenCalled();
  });
});
