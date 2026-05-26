import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SubmitTopicPage from '../src/pages/student/SubmitTopicPage';
import { createSubmission } from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  createSubmission: vi.fn()
}));

function renderSubmitTopicPage() {
  return render(
    <MemoryRouter initialEntries={['/student/submit-topic']}>
      <Routes>
        <Route path="/student/submit-topic" element={<SubmitTopicPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillValidSubmission(user) {
  await user.type(
    screen.getByLabelText(/research topic title/i),
    'Assessing student access to digital library resources today'
  );
  await user.type(screen.getByLabelText(/category/i), 'Education');
  await user.type(screen.getByLabelText(/keywords/i), 'students, library, access');
}

describe('SubmitTopicPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form, guidance, and submit button', () => {
    renderSubmitTopicPage();

    expect(screen.getByRole('heading', { name: /submit topic/i })).toBeInTheDocument();
    expect(screen.getByText(/before you submit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/research topic title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
    expect(screen.getByText(/after submission/i)).toBeInTheDocument();
  });

  it('validates required title', async () => {
    const user = userEvent.setup();
    renderSubmitTopicPage();

    await user.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('validates the 7 to 24 word title rule', async () => {
    const user = userEvent.setup();
    renderSubmitTopicPage();

    await user.type(screen.getByLabelText(/research topic title/i), 'Too short title');
    await user.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(screen.getByText('Title must be 7 to 24 words.')).toBeInTheDocument();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('submits exactly the title, category, and keywords payload', async () => {
    const user = userEvent.setup();
    createSubmission.mockResolvedValue({ id: 1 });
    renderSubmitTopicPage();

    await fillValidSubmission(user);
    await user.click(screen.getByRole('button', { name: /submit for review/i }));

    await waitFor(() => {
      expect(createSubmission).toHaveBeenCalledWith({
        title: 'Assessing student access to digital library resources today',
        category: 'Education',
        keywords: 'students, library, access'
      });
    });
  });

  it('disables the form and submit button while submission is pending', async () => {
    const user = userEvent.setup();
    let resolveSubmission;
    createSubmission.mockReturnValue(new Promise((resolve) => {
      resolveSubmission = resolve;
    }));
    renderSubmitTopicPage();

    await fillValidSubmission(user);
    await user.click(screen.getByRole('button', { name: /submit for review/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/research topic title/i)).toBeDisabled();
      expect(screen.getByLabelText(/category/i)).toBeDisabled();
      expect(screen.getByLabelText(/keywords/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    });

    resolveSubmission({ id: 1 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit for review/i })).not.toBeDisabled();
    });
  });

  it('shows success and resets fields after successful submission', async () => {
    const user = userEvent.setup();
    createSubmission.mockResolvedValue({ id: 1 });
    renderSubmitTopicPage();

    await fillValidSubmission(user);
    await user.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(await screen.findByText('Topic submitted for review.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view my submissions/i })).toHaveAttribute(
      'href',
      '/student/my-submissions'
    );
    expect(screen.getByLabelText(/research topic title/i)).toHaveValue('');
    expect(screen.getByLabelText(/category/i)).toHaveValue('');
    expect(screen.getByLabelText(/keywords/i)).toHaveValue('');
  });

  it('shows server error messages and fallback errors on rejection', async () => {
    const user = userEvent.setup();
    createSubmission.mockRejectedValueOnce({
      response: { data: { message: 'Submission window is closed.' } }
    });
    renderSubmitTopicPage();

    await fillValidSubmission(user);
    await user.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(await screen.findByText('Submission window is closed.')).toBeInTheDocument();

    createSubmission.mockRejectedValueOnce(new Error('Network error'));
    await user.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(await screen.findByText('Unable to submit topic.')).toBeInTheDocument();
  });

  it('does not expose similarity, risk, or pre-check UI', () => {
    renderSubmitTopicPage();

    expect(screen.queryByText(/similarity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/risk/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pre-check/i)).not.toBeInTheDocument();
  });
});
