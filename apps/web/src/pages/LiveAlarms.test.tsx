import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LiveAlarms } from './LiveAlarms';

const api = vi.hoisted(() => ({ list: vi.fn(), ack: vi.fn() }));
vi.mock('@contracts/index', () => ({
  ApiClient: class {
    listAlarms = api.list;
    ackAlarm = api.ack;
  },
}));
vi.mock('../components/Header', () => ({ Header: () => <header>Header</header> }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ accessToken: 'token', currentSiteId: 'site', hasPermission: () => true }),
}));

const alarm = {
  id: 'fault-1', siteId: 'site', assetId: 'unit-1', assetName: 'Plant Unit 1',
  field: 'X', severity: 'critical', status: 'active', message: 'Fault asserted',
  alarmCode: 'POINT_FAULT', raisedAt: '2026-01-01T00:00:00.000Z', clearedAt: null,
  acknowledgedBy: null, acknowledgedAt: null, acknowledgeNote: null,
};

describe('live alarm queue', () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue({ items: [alarm], nextCursor: null, activeCount: 1 });
    api.ack.mockReset().mockResolvedValue(undefined);
  });

  it('loads the site alarm and acknowledges it through the API', async () => {
    render(<LiveAlarms />);
    expect(await screen.findByText('Plant Unit 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(api.ack).toHaveBeenCalledWith('site', 'fault-1', {}));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it('shows an empty queue when the API returns no open alarms', async () => {
    api.list.mockResolvedValue({ items: [], nextCursor: null, activeCount: 0 });
    render(<LiveAlarms />);
    expect(await screen.findByText('No alarms in this view')).toBeInTheDocument();
  });
});
