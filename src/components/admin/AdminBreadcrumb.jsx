import React from 'react';
import { Link } from 'react-router-dom';

const AdminBreadcrumb = ({ items, className = '' }) => {
  if (!items || items.length === 0) {
    return null;
  }

  // default small negative top margin to lift breadcrumbs slightly
  const baseClass = `flex items-center gap-2 text-sm -mt-2 ${className}`.trim();

  return (
    <nav aria-label="Breadcrumb" className={baseClass}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
          {index === items.length - 1 ? (
            <span aria-current="page" className="text-white font-semibold">{item.label}</span>
          ) : (
            <Link
              to={item.path}
              className="text-white/80 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default AdminBreadcrumb;
