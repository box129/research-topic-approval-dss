import PropTypes from 'prop-types';
import SelectInput from './SelectInput';

function FilterDropdown({ label = 'Filter', placeholder = 'All', ...props }) {
  return (
    <SelectInput
      label={label}
      placeholder={placeholder}
      {...props}
    />
  );
}

FilterDropdown.propTypes = {
  label: PropTypes.string,
  placeholder: PropTypes.string
};

export default FilterDropdown;
