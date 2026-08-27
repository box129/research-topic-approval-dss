import PropTypes from 'prop-types';

/**
 * Renders a student the way the institution actually identifies them.
 *
 * Matric number is the primary identifier and email is optional: current UNIOSUN
 * students have no university-issued address, so a student with no email is
 * completely normal, not a record with something missing. This component exists
 * so every lecturer-facing surface agrees on that, and so no surface can drift
 * back to treating email as the identity and rendering "No email available"
 * where the identifier belongs.
 *
 * Email is shown only when present, and only as secondary detail — never as a
 * substitute for the matric number.
 */
function StudentIdentity({ name, matricNumber, email, testIdPrefix }) {
  return (
    <>
      <p
        className="break-words text-sm font-medium text-text-primary"
        data-testid={testIdPrefix ? `${testIdPrefix}-name` : undefined}
      >
        {name || 'Unnamed student'}
      </p>
      {matricNumber ? (
        <p
          className="mt-1 break-words font-mono text-sm text-text-secondary"
          data-testid={testIdPrefix ? `${testIdPrefix}-matric` : undefined}
        >
          {matricNumber}
        </p>
      ) : (
        // Only reachable for a legacy record predating matric-primary identity.
        // It reports a genuinely incomplete record rather than implying the
        // student is at fault for having no email.
        <p className="mt-1 text-sm text-text-muted" data-testid={testIdPrefix ? `${testIdPrefix}-matric-missing` : undefined}>
          No matric number on record
        </p>
      )}
      {email && (
        <p
          className="mt-1 break-all text-sm text-text-muted"
          data-testid={testIdPrefix ? `${testIdPrefix}-email` : undefined}
        >
          {email}
        </p>
      )}
    </>
  );
}

StudentIdentity.propTypes = {
  name: PropTypes.string,
  matricNumber: PropTypes.string,
  email: PropTypes.string,
  testIdPrefix: PropTypes.string
};

export default StudentIdentity;
