import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from '@contracts/index';
import type { Alarm } from '../../../../packages/contracts/src/alarm';
import { defaultBaseUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useAlarmFeed() {
  const { accessToken, currentSiteId } = useAuth();
  const client = useMemo(() => new ApiClient({ baseUrl: defaultBaseUrl(), getToken: () => accessToken }), [accessToken]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!currentSiteId || !accessToken) return;
    try {
      const page = await client.listAlarms(currentSiteId, { limit: 200 });
      setAlarms(page.items);
      setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [accessToken, client, currentSiteId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { alarms, error, refresh, client, currentSiteId };
}
