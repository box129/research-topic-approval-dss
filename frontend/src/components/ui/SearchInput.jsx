import PropTypes from 'prop-types';
import TextInput from './TextInput';

function SearchInput({ label = 'Search', placeholder = 'Search...', ...props }) {
  return (
    <TextInput
      type="search"
      label={label}
      placeholder={placeholder}
      {...props}
    />
  );
}

SearchInput.propTypes = {
  label: PropTypes.string,
  placeholder: PropTypes.string
};

export default SearchInput;
