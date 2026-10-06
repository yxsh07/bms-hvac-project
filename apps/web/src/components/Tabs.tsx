import React from 'react';
import clsx from 'clsx';
import type { TabItem } from './Header';

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'underline' }: TabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className={clsx('tabs-container px-4', className)} role="tablist" aria-label="Section tabs">
      <div className={clsx(
        'flex gap-1 overflow-x-auto pb-1 scrollbar-hide',
        variant === 'pills' && 'py-1',
        variant === 'underline' && 'border-b border-default'
      )}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            className={clsx(
              'tab-btn flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-md',
              tab.disabled
                ? 'text-content-disabled cursor-not-allowed'
                : activeTab === tab.id
                  ? variant === 'pills'
                    ? 'bg-state-selected text-content-primary'
                    : variant === 'underline'
                      ? 'text-content-primary border-b-2 border-chilled -mb-px'
                      : 'text-content-primary bg-state-hover'
                  : 'text-content-tertiary hover:text-content-primary hover:bg-state-hover'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={clsx(
                'badge ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium tabular-nums',
                activeTab === tab.id
                  ? 'bg-chilled text-white'
                  : 'bg-surface-sunken text-content-tertiary'
              )}>
                {tab.count > 99 ? '99+' : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Tab Panel component
interface TabPanelProps {
  id: string;
  tabId: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ id, tabId, activeTab, children, className }: TabPanelProps) {
  const isActive = activeTab === tabId;

  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={`${tabId}-tab`}
      hidden={!isActive}
      className={clsx('tab-panel', !isActive && 'hidden', className)}
    >
      {isActive && children}
    </div>
  );
}