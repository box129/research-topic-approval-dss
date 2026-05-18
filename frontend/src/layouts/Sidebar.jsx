import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { roleLabels, roleNavigation } from './navigation';

function Sidebar({ role }) {
  const items = roleNavigation[role] || [];

  return (
    <aside className="border-r border-gray-200 bg-white lg:min-h-screen lg:w-72">
      <div className="border-b border-gray-200 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">UNIOSUN DSS</p>
        <h1 className="mt-1 text-lg font-bold text-gray-950">{roleLabels[role]} Portal</h1>
      </div>

      <nav className="flex gap-2 overflow-x-auto px-4 py-4 lg:block lg:space-y-1 lg:overflow-visible">
        {items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => [
              'flex min-w-max items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
            ].join(' ')}
          >
            <span>{item.label}</span>
            {item.soon && (
              <span className="ml-3 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                Soon
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

Sidebar.propTypes = {
  role: PropTypes.oneOf(['lecturer', 'student', 'admin']).isRequired
};

export default Sidebar;
