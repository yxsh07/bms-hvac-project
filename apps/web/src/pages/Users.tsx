import React from 'react';
import { Header } from '../components/Header';
import { Breadcrumb } from '../components/Breadcrumb';
import clsx from 'clsx';

export function Users() {
  const breadcrumb = [
    { label: 'Dashboard', href: '/' },
    { label: 'Users' }
  ];

  const users = [
    { id: 'u1', name: 'Admin User', email: 'admin@bms.local', role: 'admin', sites: ['SimSite Hospital', 'Office Small'], status: 'Active', lastLogin: '2026-10-05 08:45' },
    { id: 'u2', name: 'HVAC Engineer', email: 'engineer@bms.local', role: 'engineer', sites: ['SimSite Hospital', 'Office Small'], status: 'Active', lastLogin: '2026-10-05 10:15' },
    { id: 'u3', name: 'Facility Manager', email: 'manager@bms.local', role: 'facility_manager', sites: ['SimSite Hospital'], status: 'Active', lastLogin: '2026-10-05 09:30' },
    { id: 'u4', name: 'Operator', email: 'operator@bms.local', role: 'operator', sites: ['SimSite Hospital'], status: 'Active', lastLogin: '2026-10-05 07:20' },
    { id: 'u5', name: 'Executive', email: 'executive@bms.local', role: 'executive', sites: ['SimSite Hospital', 'Office Small'], status: 'Inactive', lastLogin: '2026-10-04 16:00' },
  ];

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    engineer: 'HVAC Engineer',
    facility_manager: 'Facility Manager',
    operator: 'Operator',
    executive: 'Executive'
  };

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={breadcrumb} />
      <main className="pt-[var(--header-height)] pb-4" style={{ paddingTop: 'var(--header-height)' }}>
        <div className="h-[calc(100vh-var(--header-height))] p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-content-primary">Users</h1>
              <button className="px-3 py-1.5 bg-chilled text-white text-sm rounded-md hover:opacity-90 transition-opacity">Invite User</button>
            </div>

            <div className="bg-surface-base border border-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated border-b border-default">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Role</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Sites</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Last Login</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-default hover:bg-state-hover">
                      <td className="px-3 py-2 font-medium text-content-primary">{user.name}</td>
                      <td className="px-3 py-2 text-content-secondary">{user.email}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-sunken text-content-secondary">
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-content-tertiary">{user.sites.join(', ')}</td>
                      <td className="px-3 py-2">
                        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium',
                          user.status === 'Active' ? 'bg-success/10 text-success' : 'bg-surface-sunken text-content-tertiary'
                        )}>{user.status}</span>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-content-tertiary">{user.lastLogin}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded hover:bg-state-hover transition-colors text-content-tertiary" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button className="p-1.5 rounded hover:bg-state-hover transition-colors text-content-tertiary" title="Remove">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-surface-elevated border border-default rounded-lg text-sm text-content-tertiary">
              <strong>Note:</strong> RBAC enforced server-side. UI only hides unauthorized actions. 
              All permission denials are audited. Admin actions audited same as other roles.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}