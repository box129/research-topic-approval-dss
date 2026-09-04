import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmActionModal from '../src/components/ui/ConfirmActionModal';
import EmptyStatePanel from '../src/components/ui/EmptyStatePanel';
import PrimaryButton from '../src/components/ui/PrimaryButton';
import SelectInput from '../src/components/ui/SelectInput';
import StatusBadge from '../src/components/ui/StatusBadge';
import StudentIdentity from '../src/components/ui/StudentIdentity';
import TableShell from '../src/components/ui/TableShell';
import TextInput from '../src/components/ui/TextInput';

describe('foundation UI primitives', () => {
  it('renders primary button content and loading state', () => {
    const { rerender } = render(<PrimaryButton>Save</PrimaryButton>);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();

    rerender(<PrimaryButton isLoading>Save</PrimaryButton>);
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('associates text input labels, helper text, and errors', () => {
    render(
      <TextInput
        id="topic"
        label="Research topic"
        helperText="Use a clear title"
        error="Topic is required"
      />
    );

    expect(screen.getByLabelText(/research topic/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/topic is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/use a clear title/i)).not.toBeInTheDocument();
  });

  it('renders select input options', () => {
    render(
      <SelectInput
        id="category"
        label="Category"
        options={[{ label: 'Health Policy', value: 'health-policy' }]}
        placeholder="Choose category"
      />
    );

    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /health policy/i })).toBeInTheDocument();
  });

  it('renders empty state panel actions', () => {
    render(
      <EmptyStatePanel
        title="No records"
        message="Create the first record."
        action={<PrimaryButton>Add record</PrimaryButton>}
      />
    );

    expect(screen.getByText(/no records/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add record/i })).toBeInTheDocument();
  });

  it('renders table shell header and child table', () => {
    render(
      <TableShell title="Submissions" subtitle="Latest records">
        <table>
          <tbody>
            <tr>
              <td>Topic A</td>
            </tr>
          </tbody>
        </table>
      </TableShell>
    );

    expect(screen.getByText(/submissions/i)).toBeInTheDocument();
    expect(screen.getByText(/topic a/i)).toBeInTheDocument();
  });

  it('calls modal actions', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmActionModal
        isOpen
        title="Confirm decision"
        message="This cannot be undone."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole('button', { name: /confirm/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('contains modal focus, describes the consequence, and restores focus after Escape', async () => {
    const user = userEvent.setup();

    function ModalHarness() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>Open confirmation</button>
          <ConfirmActionModal
            isOpen={isOpen}
            title="Confirm decision"
            message="This action records the final decision."
            onCancel={() => setIsOpen(false)}
            onConfirm={vi.fn()}
          />
        </>
      );
    }

    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: /open confirmation/i });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: /confirm decision/i });
    expect(dialog).toHaveAccessibleDescription(/records the final decision/i);
    const cancel = within(dialog).getByRole('button', { name: /cancel/i });
    const confirm = within(dialog).getByRole('button', { name: /^confirm$/i });
    expect(cancel).toHaveFocus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(confirm).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(cancel).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

// Board D — Family B workflow-status pill contract. StatusBadge encodes where
// a real submission stands and nothing else; stored tokens are never mutated
// and unknown tokens can never borrow decision semantics.
describe('StatusBadge workflow contract', () => {
  it.each([
    ['pending', 'Pending review', 'text-status-pending'],
    ['pending_review', 'Pending review', 'text-status-pending'],
    ['approved', 'Approved', 'text-status-approved'],
    ['awaiting_revision', 'Revision requested', 'text-status-revision'],
    ['rejected', 'Rejected', 'text-status-rejected'],
    ['not_submitted', 'Not submitted', 'text-status-neutral']
  ])('renders %s as "%s" with its workflow semantics', (token, label, semanticClass) => {
    render(<StatusBadge status={token} />);

    const pill = screen.getByText(label);
    expect(pill.className).toContain(semanticClass);
  });

  it('gives unknown tokens the neutral fallback and never a decision colour', () => {
    render(<StatusBadge status="some_future_status" />);

    const pill = screen.getByText('Some future status');
    expect(pill.className).toContain('text-status-neutral');
    expect(pill.className).not.toMatch(/status-approved|status-revision|status-rejected|status-pending(?!-)/);
  });

  it('uses 14px operational text and never wraps', () => {
    render(<StatusBadge status="awaiting_revision" />);

    const pill = screen.getByText('Revision requested');
    expect(pill.className).toContain('text-sm');
    expect(pill.className).not.toContain('text-xs');
    expect(pill.className).toContain('whitespace-nowrap');
  });

  it('carries no similarity-classification semantics', () => {
    render(<StatusBadge status="approved" />);

    const pill = screen.getByText('Approved');
    expect(pill.textContent).not.toMatch(/HIGH|MEDIUM|LOW|similarity|risk/i);
    expect(pill.className).not.toMatch(/risk-/);
  });
});

// Board D2 — StudentIdentity wrapping contract. Matric-first identity is
// unchanged; the email gets room first and restrained wrapping last, never
// break-all/anywhere shattering.
describe('StudentIdentity identity/wrapping contract', () => {
  const longPersonalEmail = 'adewale.oluwaseun.adebayo@gmail.com';

  it('wraps a long personal email restrainedly, never with break-all', () => {
    render(
      <StudentIdentity
        name="Adewale Adebayo"
        matricNumber="HPS/2023/041"
        email={longPersonalEmail}
        testIdPrefix="identity"
      />
    );

    const email = screen.getByTestId('identity-email');
    expect(email).toHaveTextContent(longPersonalEmail);
    expect(email.className).toContain('break-words');
    expect(email.className).not.toContain('break-all');
    expect(email.className).not.toMatch(/anywhere/);
  });

  it('keeps the matric number primary, mono, and readable', () => {
    render(
      <StudentIdentity name="Adewale Adebayo" matricNumber="HPS/2023/041" email={longPersonalEmail} testIdPrefix="identity" />
    );

    const matric = screen.getByTestId('identity-matric');
    expect(matric).toHaveTextContent('HPS/2023/041');
    expect(matric.className).toContain('text-sm');
    expect(matric.className).toContain('font-mono');
  });

  it('renders nothing for an omitted email — no placeholder, no invented address', () => {
    render(<StudentIdentity name="Adewale Adebayo" matricNumber="HPS/2023/041" email={null} testIdPrefix="identity" />);

    expect(screen.queryByTestId('identity-email')).not.toBeInTheDocument();
    expect(screen.queryByText(/no email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@uniosun/i)).not.toBeInTheDocument();
  });

  it('keeps the truthful legacy wording for a missing matric number', () => {
    render(<StudentIdentity name="Legacy Student" matricNumber={null} email={null} testIdPrefix="identity" />);

    expect(screen.getByTestId('identity-matric-missing')).toHaveTextContent('No matric number on record');
  });
});
