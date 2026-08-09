import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuperviseesPage from '../src/pages/lecturer/SuperviseesPage';
import { listLecturerSupervisees } from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  listLecturerSupervisees: vi.fn()
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/supervisees']}>
      <SuperviseesPage />
    </MemoryRouter>
  );
}

const assignment = {
  id: 10,
  student: {
    id: 3,
    name: 'Student One',
    email: 'student.one@example.edu',
    role: 'student',
    status: 'active'
  },
  lecturer: {
    id: 2,
    name: 'Lecturer One',
    email: 'lecturer.one@example.edu',
    role: 'lecturer',
    status: 'active'
  },
  assignedAt: '2026-06-22T09:00:00.000Z',
  latestSubmission: {
    id: 71,
    title: 'Knowledge of malaria prevention among undergraduate public health students',
    category: 'Public Health',
    status: 'pending_review',
    submittedAt: '2026-06-22T08:00:00.000Z',
    decidedAt: null
  }
};

describe('Lecturer SuperviseesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while supervisees are requested', () => {
    listLecturerSupervisees.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText(/loading supervisees/i)).toBeInTheDocument();
  });

  it('renders real assigned supervisees from the endpoint', async () => {
    listLecturerSupervisees.mockResolvedValue({
      data: { items: [assignment] },
      meta: {
        assignmentSource: 'LecturerSuperviseeAssignment'
      }
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/student one/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/student.one@example.edu/i)).toBeInTheDocument();
    expect(screen.getByText(/knowledge of malaria prevention/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pending review/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/sample supervisee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fake progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/passwordHash/i)).not.toBeInTheDocument();
  });

  it('shows honest empty state when no assignments exist', async () => {
    listLecturerSupervisees.mockResolvedValue({
      data: { items: [] },
      meta: {
        assignmentSource: 'LecturerSuperviseeAssignment'
      }
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no assigned supervisees/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/no students are currently assigned to you/i)).toBeInTheDocument();
  });

  it('shows error and retry state without fallback rows', async () => {
    listLecturerSupervisees
      .mockRejectedValueOnce({
        response: {
          data: {
            error: {
              message: 'Supervisee endpoint unavailable.'
            }
          }
        }
      })
      .mockResolvedValueOnce({
        data: { items: [assignment] },
        meta: {}
      });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/supervisee endpoint unavailable/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/student one/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText(/student one/i)).toBeInTheDocument();
    });
    expect(listLecturerSupervisees).toHaveBeenCalledTimes(2);
  });

  it('does not render unsupported progress or export actions', async () => {
    listLecturerSupervisees.mockResolvedValue({
      data: { items: [assignment] },
      meta: {}
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/student one/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /assign supervisee/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/matric number: 000/i)).not.toBeInTheDocument();
  });
});
