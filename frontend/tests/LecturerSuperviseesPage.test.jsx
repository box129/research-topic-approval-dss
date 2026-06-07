import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SuperviseesPage from '../src/pages/lecturer/SuperviseesPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/supervisees']}>
      <SuperviseesPage />
    </MemoryRouter>
  );
}

describe('Lecturer SuperviseesPage', () => {
  it('keeps supervisees honest as deferred when no assignment model exists', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /supervisees/i })).toBeInTheDocument();
    expect(screen.getByText(/no explicit assignment model is available yet/i)).toBeInTheDocument();
    expect(screen.getByText(/reviewed submissions are not treated as supervisees/i)).toBeInTheDocument();
    expect(screen.getByText(/current schema has no real supervisee assignment source or endpoint/i)).toBeInTheDocument();
  });

  it('does not render fake supervisee rows or unsupported progress actions', () => {
    renderPage();

    expect(screen.queryByText(/sample supervisee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fake progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/matric number: 000/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /assign supervisee/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });
});
