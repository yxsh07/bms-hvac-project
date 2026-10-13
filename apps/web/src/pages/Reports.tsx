import React from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import clsx from 'clsx';
import { REPORT_CATALOG } from '../fixtures/reportsData';

export function Reports() {
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Reports' }
  ];

  const reports = REPORT_CATALOG;

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-xl font-semibold text-content-primary">Reports</h1>
            <p className="text-content-tertiary">Report catalog preview. Generation and history are unavailable in this prototype.</p>

            <div className="space-y-3">
              {reports.map(report => (
                <div key={report.id} className="p-4 rounded-lg border border-default bg-surface-base">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-content-primary">{report.name}</h3>
                      <p className="text-sm text-content-tertiary mt-1">{report.description}</p>
                    </div>
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                      report.status === 'Ready' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                    )}>{report.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-content-tertiary flex-wrap mb-2">
                    <span>Persona: <span className="text-content-secondary">{report.persona}</span></span>
                    <span>Formats: <span className="font-mono">{report.formats.join(', ')}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled title="Unavailable in this prototype" className="px-3 py-1.5 bg-chilled text-white text-sm rounded-md">Run Report</button>
                    <button disabled title="Unavailable in this prototype" className="px-3 py-1.5 bg-surface-sunken text-content-primary text-sm rounded-md border border-default">View History</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
