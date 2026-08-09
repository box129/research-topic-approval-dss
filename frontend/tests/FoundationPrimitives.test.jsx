import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmActionModal from '../src/components/ui/ConfirmActionModal';
import EmptyStatePanel from '../src/components/ui/EmptyStatePanel';
import PrimaryButton from '../src/components/ui/PrimaryButton';
import SelectInput from '../src/components/ui/SelectInput';
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
