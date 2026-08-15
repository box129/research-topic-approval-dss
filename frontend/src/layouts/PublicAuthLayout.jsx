import PropTypes from 'prop-types';
import './PublicAuthLayout.css';

function PublicAuthLayout({ children }) {
  return (
    <div className="public-auth-shell">
      <header className="public-auth-header">
        <div className="public-auth-header__inner">
          <span className="public-auth-mark" aria-hidden="true">U</span>
          <div><p>UNIOSUN</p><span>Research Topic Approval DSS</span></div>
        </div>
      </header>
      <main className="public-auth-main"><div className="public-auth-card">{children}</div><p className="public-auth-footer">Osun State University</p></main>
    </div>
  );
}

PublicAuthLayout.propTypes = { children: PropTypes.node.isRequired };
export default PublicAuthLayout;
