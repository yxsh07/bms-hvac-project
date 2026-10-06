import React, { useState, useEffect } from 'react';
import clsx from 'clsx';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
  width?: number;
  className?: string;
  showBackdrop?: boolean;
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  width = 360,
  className,
  showBackdrop = true
}: SidePanelProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => {
        setIsAnimating(false);
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  return (
    <>
      {showBackdrop && (
        <div
          className={clsx(
            'fixed inset-0 z-[199] bg-surface-overlay transition-opacity',
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={clsx(
          'fixed top-0 z-[200] flex flex-col transition-transform duration-300 ease-out',
          position === 'left'
            ? 'left-0 h-full border-r border-default'
            : 'right-0 h-full border-l border-default',
          isOpen
            ? 'translate-x-0'
            : position === 'left'
              ? '-translate-x-full'
              : 'translate-x-full',
          className
        )}
        style={{ width: `${width}px`, maxWidth: '100vw' }}
        role="complementary"
        aria-label={title || 'Side panel'}
      >
        <div className="side-panel-header flex items-center justify-between px-4 py-3 border-b border-default bg-surface-elevated">
          {title && <h2 className="text-sm font-semibold text-content-primary">{title}</h2>}
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-state-hover transition-colors text-content-tertiary hover:text-content-primary"
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="side-panel-content flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </aside>
    </>
  );
}

// Responsive side panel hook
export function useResponsiveSidePanel(breakpoint: number = 1024) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}