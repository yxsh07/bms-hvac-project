import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LiveSetpoints } from './LiveSetpoints';

const propose = vi.fn(async () => ({ id: 'request-1' }));
vi.mock('@contracts/index', () => ({
  ApiClient: class {
    listWritableSetpoints = async () => [{ assetId: 'asset-1', assetName: 'Asset 1', field: 'SP', display: 'Water target', unit: '°C', safeMin: 5, safeMax: 16, currentValue: 8, liveRequest: null }];
    listSetpointRequests = async () => ({ items: [], nextCursor: null });
    proposeSetpoint = propose;
  },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ accessToken: 'real-token', currentSiteId: 'test-site', hasPermission: () => true }),
}));
vi.mock('../components/Header', () => ({ Header: () => null }));

describe('live set-point workflow', () => {
  it('submits a validated proposal through the API client', async () => {
    render(<LiveSetpoints />);
    await screen.findByText('Asset 1 · Water target');
    fireEvent.change(screen.getByLabelText('Proposed value'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Review comfort response' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit proposal' }));
    await waitFor(() => expect(propose).toHaveBeenCalledWith(
      'test-site', 'asset-1', 'SP', { value: 9, justification: 'Review comfort response' }, expect.any(String),
    ));
  });
});
