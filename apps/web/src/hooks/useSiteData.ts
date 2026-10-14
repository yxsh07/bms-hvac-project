import { useEffect, useMemo, useState } from 'react';
import { ApiClient } from '@contracts/index';
import type { FloorSummaryResponse, PlantKpis } from '../../../../packages/contracts/src/telemetry';
import { defaultBaseUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AssetSummary { id: string; name: string; type: string }

/** Role-resolved live read model shared by the overview, plant and twin. */
export function useSiteData() {
  const { accessToken, currentSiteId } = useAuth();
  const client = useMemo(() => new ApiClient({ baseUrl: defaultBaseUrl(), getToken: () => accessToken }), [accessToken]);
  const [plant, setPlant] = useState<PlantKpis | null>(null);
  const [floors, setFloors] = useState<FloorSummaryResponse | null>(null);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSiteId || !accessToken) return;
    let alive = true;
    const refresh = async () => {
      try {
        const [nextPlant, nextFloors, nextAssets] = await Promise.all([
          client.plantKpis(currentSiteId), client.floorsSummary(currentSiteId), client.listAssets(currentSiteId),
        ]);
        if (alive) { setPlant(nextPlant); setFloors(nextFloors); setAssets(nextAssets); setError(null); }
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [client, currentSiteId, accessToken]);

  return { plant, floors, assets, error };
}
