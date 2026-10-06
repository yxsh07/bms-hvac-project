import React from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import clsx from 'clsx';
import { AUDIT_ENTRIES } from '../fixtures/auditData';

export function Audit() {
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Audit Trail' }
  ];

  const auditEntries = AUDIT_ENTRIES;

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] p-4 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-content-primary">Audit Trail</h1>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-chilled text-white text-sm rounded-md hover:opacity-90 transition-opacity">Verify Chain</button>
                <button className="px-3 py-1.5 bg-surface-sunken text-content-primary text-sm rounded-md border border-default hover:bg-state-hover transition-colors">Export</button>
              </div>
            </div>

            <div className="bg-surface-base border border-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated border-b border-default">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Time (UTC)</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">User</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Action</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Resource</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Details</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-default hover:bg-state-hover">
                      <td className="px-3 py-2 font-mono tabular-nums text-content-tertiary">{entry.time}</td>
                      <td className="px-3 py-2 text-content-primary">{entry.user}</td>
                      <td className="px-3 py-2">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium',
                          entry.action.includes('DENIED') ? 'bg-critical/10 text-critical' :
                          entry.action.includes('LOGIN') ? 'bg-success/10 text-success' :
                          entry.action.includes('PROPOSED') ? 'bg-warning/10 text-warning' :
                          entry.action.includes('APPROVED') ? 'bg-chilled/10 text-chilled' :
                          entry.action.includes('APPLIED') ? 'bg-success/10 text-success' :
                          'bg-surface-sunken text-content-tertiary'
                        )}>{entry.action}</span>
                      </td>
                      <td className="px-3 py-2 text-content-secondary">{entry.resource}</td>
                      <td className="px-3 py-2 font-mono tabular-nums text-sm text-content-primary">{entry.details}</td>
                      <td className="px-3 py-2">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium',
                          entry.status === 'SUCCESS' || entry.status === 'APPLIED' ? 'bg-success/10 text-success' :
                          entry.status === 'PENDING' || entry.status === 'APPROVED' ? 'bg-warning/10 text-warning' :
                          entry.status === 'DENIED' ? 'bg-critical/10 text-critical' :
                          'bg-surface-sunken text-content-tertiary'
                        )}>{entry.status}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={clsx('flex items-center gap-1 text-[11px]',
                          entry.verified ? 'text-success' : 'text-critical'
                        )}>
                          {entry.verified ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                              Verified
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              Failed
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-surface-elevated border border-default rounded-lg text-sm text-content-tertiary">
              <strong>Chain Verification:</strong> HMAC-SHA256 with canonical JSON, per-site advisory lock. 
              <button className="ml-2 px-2 py-1 text-chilled hover:underline text-sm">Run verification now</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}