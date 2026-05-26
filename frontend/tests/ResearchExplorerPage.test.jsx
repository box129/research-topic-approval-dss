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

  it('renders Research Explorer header and student-facing guidance', () => {
    renderResearchExplorerPage();

    expect(screen.getByRole('heading', { name: /research explorer/i })).toBeInTheDocument();
    expect(screen.getByText(/explorer-ready shell/i)).toBeInTheDocument();
    expect(screen.getByText(/no student-safe read endpoint is connected yet/i)).toBeInTheDocument();
  });

  it('shows disabled search control', () => {
    renderResearchExplorerPage();

    expect(screen.getByLabelText(/search approved topics/i)).toBeDisabled();
    expect(screen.getByText(/search will become available/i)).toBeInTheDocument();
  });

  it('shows disabled filter control', () => {
    renderResearchExplorerPage();

    expect(screen.getByLabelText(/category/i)).toBeDisabled();
    expect(screen.getByText(/filters are disabled/i)).toBeInTheDocument();
  });

  it('shows honest empty state instead of fake approved topics', () => {
    renderResearchExplorerPage();

    expect(screen.getByText('No approved topic explorer data is available yet.')).toBeInTheDocument();
    expect(screen.getByText(/no approved-topic browsing endpoint is currently connected/i)).toBeInTheDocument();
    expect(screen.queryByText(/machine learning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/malaria prevention/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sample approved topic/i)).not.toBeInTheDocument();
  });

  it('links to Check My Topic', async () => {
    const user = userEvent.setup();
    renderResearchExplorerPage();

    await user.click(screen.getByRole('button', { name: /check my topic/i }));

    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/check-my-topic');
  });

  it('links to Submit Topic', async () => {
    const user = userEvent.setup();
    renderResearchExplorerPage();

    await user.click(screen.getByRole('button', { name: /submit topic/i }));

    expect(screen.getByTestId('location-display')).toHaveTextContent('/student/submit-topic');
  });

  it('does not call fetch, axios, apiClient, or repository endpoints', () => {
    renderResearchExplorerPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('does not expose deferred analytics, export, or recommendation features', () => {
    renderResearchExplorerPage();

    expect(screen.queryByText(/advanced analytics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/heatmap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recommendation engine/i)).not.toBeInTheDocument();
  });

  it('does not expose similarity scores, snapshots, lecturer, or admin UI', () => {
    renderResearchExplorerPage();

    expect(screen.queryByText(/similarity score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lecturer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin/i)).not.toBeInTheDocument();
  });

  it('shows planned explorer areas without fake topic details', () => {
    renderResearchExplorerPage();

    expect(screen.getAllByText(/approved topics/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/category discovery/i)).toBeInTheDocument();
    expect(screen.getByText(/keyword trends/i)).toBeInTheDocument();
    expect(screen.getByText(/underexplored areas/i)).toBeInTheDocument();
    expect(screen.queryByText(/supervisor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/session year/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/topic details/i)).not.toBeInTheDocument();
  });
});
