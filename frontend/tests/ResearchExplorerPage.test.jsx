import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios from 'axios';
import apiClient from '../src/api/client';
import ResearchExplorerPage from '../src/pages/student/ResearchExplorerPage';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderResearchExplorerPage() {
  return render(
    <MemoryRouter initialEntries={['/student/research-explorer']}>
      <Routes>
        <Route path="/student/research-explorer" element={<ResearchExplorerPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResearchExplorerPage', () => {
  let fetchSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('renders one concise, student-facing unavailable explanation', () => {
    renderResearchExplorerPage();

    expect(screen.getByRole('heading', { name: /research explorer/i })).toBeInTheDocument();
    expect(screen.getByText(/approved-topic browsing is not currently available in the student workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/check a proposed topic for similarity or submit a topic/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /approved-topic browsing/i })).not.toBeInTheDocument();
  });

  it('renders genuinely disabled search and category controls', () => {
    renderResearchExplorerPage();

    expect(screen.getByLabelText(/search approved topics/i)).toBeDisabled();
    expect(screen.getByLabelText(/search approved topics/i)).toHaveAttribute('placeholder', 'Not currently available');
    expect(screen.getByLabelText(/category/i)).toBeDisabled();
    expect(screen.getByLabelText(/category/i)).toHaveValue('Not currently available');
  });

  it('provides only the supported Student destinations', async () => {
    const user = userEvent.setup();
    const { unmount } = renderResearchExplorerPage();

    expect(screen.getAllByRole('button')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /check my topic/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/check-my-topic');

    unmount();
    renderResearchExplorerPage();
    await user.click(screen.getByRole('button', { name: /submit topic/i }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/submit-topic');
  });

  it('does not make a data request', () => {
    renderResearchExplorerPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('does not expose fake records or unsupported explorer features', () => {
    renderResearchExplorerPage();

    expect(screen.queryByText(/sample approved topic|machine learning|malaria prevention/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trend|recommendation|research gap|analytics|pagination|export/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /details/i })).not.toBeInTheDocument();
  });
});
