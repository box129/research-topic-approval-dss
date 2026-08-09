import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  it('shows loading while requesting the real submission history', () => {
    listSubmissions.mockReturnValue(new Promise(() => {}));
    renderMySubmissionsPage();

    expect(screen.getByText(/loading submissions/i)).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledTimes(1);
  });

  it('shows an error and retries the request', async () => {
    const user = userEvent.setup();
    listSubmissions
      .mockRejectedValueOnce({ response: { data: { message: 'Unable to reach submissions service.' } } })
      .mockResolvedValueOnce([]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/unable to reach submissions service/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
    expect(listSubmissions).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state with supported Student actions', async () => {
    const user = userEvent.setup();
    listSubmissions.mockResolvedValue([]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /^submit topic$/i })[0]);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/submit-topic');
  });

  it('renders record-led history and a summary derived from returned statuses', async () => {
    listSubmissions.mockResolvedValue([
      {
        id: 1,
        title: 'Assessing digital library access among undergraduate students',
        status: 'pending',
        category: 'Education',
        keywords: 'library, students',
        session_name: '2025/2026',
        submitted_at: '2026-05-20T10:00:00.000Z'
      },
      {
        id: 2,
        title: 'Sanitation practice assessment in public secondary schools',
        status: 'awaiting_revision',
        decision_reason: 'Narrow the study population before resubmission.',
        decided_at: '2026-05-22T13:30:00.000Z',
        submitted_at: '2026-05-18T09:00:00.000Z'
      },
      {
        id: 3,
        title: 'Evaluation of antenatal care uptake in Osun State',
        status: 'approved',
        submitted_at: '2026-05-19T10:00:00.000Z'
      },
      {
        id: 4,
        title: 'Rejected student research topic',
        status: 'rejected',
        submitted_at: '2026-05-17T10:00:00.000Z'
      }
    ]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/assessing digital library access/i)).toBeInTheDocument();
    expect(screen.getByText(/session 2025\/2026/i)).toBeInTheDocument();
    expect(screen.getByText(/keywords: library, students/i)).toBeInTheDocument();
    const summary = screen.getByLabelText(/submission summary/i);
    expect(within(summary).getByText('4')).toBeInTheDocument();
    expect(within(summary).getByText('2')).toBeInTheDocument();
    expect(within(summary).getAllByText('1')).toHaveLength(2);
  });

  it.each([
    ['pending_review', 'Pending review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['awaiting_revision', 'Awaiting revision']
  ])('shows the %s status text without relying on colour', async (status, label) => {
    listSubmissions.mockResolvedValue([{
      id: 1,
      title: 'Status coverage student topic',
      status,
      submitted_at: '2026-05-20T10:00:00.000Z'
    }]);
    renderMySubmissionsPage();

    const record = (await screen.findByText(/status coverage student topic/i)).closest('article');
    expect(within(record).getByText(new RegExp(`^${label}$`, 'i'))).toBeInTheDocument();
  });

  it('places lecturer feedback beneath the record metadata', async () => {
    listSubmissions.mockResolvedValue([{
      id: 2,
      title: 'Sanitation practice assessment in public secondary schools',
      status: 'awaiting_revision',
      decision_reason: 'Narrow the study population before resubmission.',
      decided_at: '2026-05-22T13:30:00.000Z',
      submitted_at: '2026-05-18T09:00:00.000Z'
    }]);
    renderMySubmissionsPage();

    const record = (await screen.findByText(/sanitation practice assessment/i)).closest('article');
    expect(within(record).getByRole('heading', { name: /lecturer feedback/i })).toBeInTheDocument();
    expect(within(record).getByText(/narrow the study population/i)).toBeInTheDocument();
    expect(within(record).getByText(/decision recorded may 22, 2026/i)).toBeInTheDocument();
  });

  it('truthfully reports when a decided record has no additional comment', async () => {
    listSubmissions.mockResolvedValue([{
      id: 3,
      title: 'Approved record without a comment',
      status: 'approved',
      submitted_at: '2026-05-19T10:00:00.000Z'
    }]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/approved record without a comment/i)).toBeInTheDocument();
    expect(screen.getByText(/no additional comment was provided/i)).toBeInTheDocument();
  });

  it('renders unknown statuses neutrally', async () => {
    listSubmissions.mockResolvedValue([{
      id: 5,
      title: 'Custom status student topic',
      status: 'department_hold',
      created_at: '2026-05-24T08:00:00.000Z'
    }]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/custom status student topic/i)).toBeInTheDocument();
    expect(screen.getByText(/department hold/i)).toHaveClass('bg-status-neutral-bg');
    expect(screen.queryByRole('heading', { name: /lecturer feedback/i })).not.toBeInTheDocument();
  });

  it('does not expose private fields or unsupported record actions', async () => {
    listSubmissions.mockResolvedValue([{
      id: 6,
      title: 'Safe feedback display topic',
      status: 'awaiting_revision',
      decision_reason: 'Please tighten the title scope.',
      decided_by_id: '9999',
      reviewer_name: 'Dr. Hidden Reviewer',
      similarity_summary: 'Hidden summary content'
    }]);
    renderMySubmissionsPage();

    expect(await screen.findByText(/safe feedback display topic/i)).toBeInTheDocument();
    expect(screen.getByText(/please tighten the title scope/i)).toBeInTheDocument();
    expect(screen.queryByText(/9999|dr\. hidden reviewer|hidden summary content/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|withdraw|delete|resubmit|appeal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /details/i })).not.toBeInTheDocument();
  });
});
