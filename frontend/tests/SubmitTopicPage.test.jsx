import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SubmitTopicPage from '../src/pages/student/SubmitTopicPage';
import { createSubmission } from '../src/api/submissions';

vi.mock('../src/api/submissions', () => ({
  createSubmission: vi.fn()
}));

const validTitle = 'Assessing student access to digital library resources today';

function renderSubmitTopicPage() {
  return render(
    <MemoryRouter initialEntries={['/student/submit-topic']}>
      <Routes>
        <Route path="/student/submit-topic" element={<SubmitTopicPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function fillValidSubmission() {
  fireEvent.change(screen.getByLabelText(/research topic title/i), { target: { value: validTitle } });
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Education' } });
  fireEvent.change(screen.getByLabelText(/keywords/i), { target: { value: 'students, library, access' } });
}

async function openReview(user) {
  await user.click(screen.getByRole('button', { name: /review and submit/i }));
  return screen.getByRole('region', { name: /before you submit/i });
}

describe('SubmitTopicPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the guided form with required and optional fields', () => {
    renderSubmitTopicPage();

    expect(screen.getByRole('heading', { name: /^submit topic$/i })).toBeInTheDocument();
    expect(screen.getByText(/submitting creates a pending topic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/research topic title/i)).toBeRequired();
    expect(screen.getByLabelText(/category/i)).not.toBeRequired();
    expect(screen.getByLabelText(/keywords/i)).not.toBeRequired();
    expect(screen.getByRole('button', { name: /review and submit/i })).toBeInTheDocument();
  });

  it('validates the required title accessibly without posting', async () => {
    const user = userEvent.setup();
    renderSubmitTopicPage();

    await user.click(screen.getByRole('button', { name: /review and submit/i }));

    const title = screen.getByLabelText(/research topic title/i);
    expect(screen.getByText('Title is required.')).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription(/title is required/i);
    await waitFor(() => expect(title).toHaveFocus());
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it.each([
    ['Too short title', '3'],
    ['one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five', '25']
  ])('enforces the 7 to 24 word title rule for a %s word title', async (title, count) => {
    const user = userEvent.setup();
    renderSubmitTopicPage();

    fireEvent.change(screen.getByLabelText(/research topic title/i), { target: { value: title } });
    expect(screen.getByText(`${count} words`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /review and submit/i }));

    expect(screen.getByText('Title must be 7 to 24 words.')).toBeInTheDocument();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('opens a local review state and performs no POST before confirmation', async () => {
    const user = userEvent.setup();
    renderSubmitTopicPage();
    fillValidSubmission();

    const review = await openReview(user);

    expect(createSubmission).not.toHaveBeenCalled();
    expect(within(review).getByText(validTitle)).toBeInTheDocument();
    expect(within(review).getByText('Education')).toBeInTheDocument();
    expect(within(review).getByText('students, library, access')).toBeInTheDocument();
    expect(within(review).getByText(/nothing has been saved yet/i)).toBeInTheDocument();
    expect(review).toHaveFocus();
    expect(screen.getByLabelText(/research topic title/i)).toBeDisabled();
    expect(screen.getByLabelText(/category/i)).toBeDisabled();
    expect(screen.getByLabelText(/keywords/i)).toBeDisabled();
  });

  it('returns to editing without losing field values', async () => {
    const user = userEvent.setup();
    renderSubmitTopicPage();
    fillValidSubmission();
    await openReview(user);

    await user.click(screen.getByRole('button', { name: /back to edit/i }));

    expect(screen.getByLabelText(/research topic title/i)).toHaveValue(validTitle);
    expect(screen.getByLabelText(/category/i)).toHaveValue('Education');
    expect(screen.getByLabelText(/keywords/i)).toHaveValue('students, library, access');
    expect(screen.getByLabelText(/research topic title/i)).toHaveFocus();
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it('sends the existing exact payload only after final confirmation', async () => {
    const user = userEvent.setup();
    createSubmission.mockResolvedValue({ id: 1 });
    renderSubmitTopicPage();
    fillValidSubmission();
    await openReview(user);

    await user.click(screen.getByRole('button', { name: /confirm submission/i }));

    await waitFor(() => {
      expect(createSubmission).toHaveBeenCalledTimes(1);
      expect(createSubmission).toHaveBeenCalledWith({
        title: validTitle,
        category: 'Education',
        keywords: 'students, library, access'
      });
    });
  });

  it('submits optional fields as empty strings without requiring them', async () => {
    const user = userEvent.setup();
    createSubmission.mockResolvedValue({ id: 1 });
    renderSubmitTopicPage();

    fireEvent.change(screen.getByLabelText(/research topic title/i), { target: { value: validTitle } });
    await openReview(user);
    await user.click(screen.getByRole('button', { name: /confirm submission/i }));

    await waitFor(() => expect(createSubmission).toHaveBeenCalledWith({
      title: validTitle,
      category: '',
      keywords: ''
    }));
  });

  it('announces pending submission and prevents duplicate activation', async () => {
    const user = userEvent.setup();
    let resolveSubmission;
    createSubmission.mockReturnValue(new Promise((resolve) => {
      resolveSubmission = resolve;
    }));
    renderSubmitTopicPage();
    fillValidSubmission();
    await openReview(user);

    const confirmButton = screen.getByRole('button', { name: /confirm submission/i });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(await screen.findByText(/submitting topic for review/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    expect(screen.getByLabelText(/research topic title/i)).toBeDisabled();
    expect(createSubmission).toHaveBeenCalledTimes(1);

    resolveSubmission({ id: 1 });
    expect(await screen.findByText(/topic submitted for review/i)).toBeInTheDocument();
  });

  it('focuses a request error and preserves values for recovery', async () => {
    const user = userEvent.setup();
    createSubmission.mockRejectedValue({
      response: { data: { message: 'Submission window is closed.' } }
    });
    renderSubmitTopicPage();
    fillValidSubmission();
    await openReview(user);
    await user.click(screen.getByRole('button', { name: /confirm submission/i }));

    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent('Submission window is closed.');
    expect(screen.getByLabelText(/research topic title/i)).toHaveValue(validTitle);
    expect(screen.getByLabelText(/category/i)).toHaveValue('Education');
    expect(screen.getByLabelText(/keywords/i)).toHaveValue('students, library, access');
    expect(screen.getByRole('button', { name: /review and submit/i })).toBeEnabled();
  });

  it('uses the fallback request error without losing the proposal', async () => {
    const user = userEvent.setup();
    createSubmission.mockRejectedValue(new Error('Network error'));
    renderSubmitTopicPage();
    fireEvent.change(screen.getByLabelText(/research topic title/i), { target: { value: validTitle } });
    await openReview(user);
    await user.click(screen.getByRole('button', { name: /confirm submission/i }));

    expect(await screen.findByText('Unable to submit topic.')).toBeInTheDocument();
    expect(screen.getByLabelText(/research topic title/i)).toHaveValue(validTitle);
  });

  it('replaces the editable workflow with a truthful success state', async () => {
    const user = userEvent.setup();
    createSubmission.mockResolvedValue({ id: 'private-id', reviewer_name: 'Dr. Hidden Reviewer' });
    renderSubmitTopicPage();
    fillValidSubmission();
    await openReview(user);
    await user.click(screen.getByRole('button', { name: /confirm submission/i }));

    expect(await screen.findByRole('heading', { name: /topic submitted for review/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/research topic title/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm submission/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view my submissions/i })).toHaveAttribute('href', '/student/my-submissions');
    expect(screen.getByRole('link', { name: /return to dashboard/i })).toHaveAttribute('href', '/student/dashboard');
    expect(screen.queryByText(/private-id|dr\. hidden reviewer|unique|original|approved/i)).not.toBeInTheDocument();
  });
});
