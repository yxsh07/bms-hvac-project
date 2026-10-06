import React from 'react';
import clsx from 'clsx';
import type { BreadcrumbItem } from './Header';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav className={clsx('breadcrumb flex items-center gap-1.5 px-4 h-[var(--breadcrumb-height)] bg-surface-elevated border-b border-default text-sm', className)} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 flex-wrap" role="list">
        {items.map((item, index) => (
          <li key={item.href || item.label || index} className="flex items-center gap-1.5">
            {index > 0 && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-content-tertiary flex-shrink-0" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
            {item.href || item.onClick ? (
              <button
                onClick={item.onClick}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
                  item.href ? 'text-content-secondary hover:text-content-primary hover:bg-state-hover' : 'text-content-primary font-medium'
                )}
                aria-current={index === items.length - 1 ? 'page' : undefined}
              >
                {item.label}
              </button>
            ) : (
              <span className="text-content-primary font-medium px-2 py-1" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}