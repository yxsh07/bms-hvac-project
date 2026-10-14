import { useEffect, useMemo, useState } from 'react';
import { ApiClient } from '@contracts/index';
import type { SiteDetail } from '../../../../packages/contracts/src/ontology';
import { defaultBaseUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useSiteEnvironment(): SiteDetail['environment'] | undefined {
  const { accessToken, currentSiteId } = useAuth();
  const client = useMemo(() => new ApiClient({ baseUrl: defaultBaseUrl(), getToken: () => accessToken }), [accessToken]);
  const [environment, setEnvironment] = useState<SiteDetail['environment']>();

  useEffect(() => {
    let alive = true;
    setEnvironment(undefined);
    if (!currentSiteId || !accessToken) return;
    const refresh = async () => {
      try {
        const site = await client.getSite(currentSiteId);
        if (alive) setEnvironment(site.environment);
      } catch { if (alive) setEnvironment(undefined); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [accessToken, client, currentSiteId]);

  return environment;
}
