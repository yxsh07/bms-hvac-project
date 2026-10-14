import { useEffect, useMemo, useState } from 'react';
import { ApiClient } from '@contracts/index';
import type { FloorSummaryResponse, PlantKpis } from '../../../../packages/contracts/src/telemetry';
import type { Ontology } from '../../../../packages/contracts/src/ontology';
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
  const [ontology, setOntology] = useState<Ontology | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSiteId || !accessToken) return;
    let alive = true;
    const refresh = async () => {
      try {
        const [nextPlant, nextFloors, nextAssets, nextOntology] = await Promise.all([
          client.plantKpis(currentSiteId), client.floorsSummary(currentSiteId),
          client.listAssets(currentSiteId), client.getOntology(currentSiteId),
        ]);
        if (alive) { setPlant(nextPlant); setFloors(nextFloors); setAssets(nextAssets); setOntology(nextOntology); setError(null); }
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [client, currentSiteId, accessToken]);

  return { plant, floors, assets, ontology, error };
}
