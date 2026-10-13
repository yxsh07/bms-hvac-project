# Meeting prototype

Start Docker Desktop, then run from the repository root:

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

Open http://localhost:5173. The login page has a demo engineer account prefilled.

1. Open the main menu and choose **Building twin**. Select a floor, drag to orbit, scroll to zoom, move the Expand slider, then switch to **Floor plans** for the 2D view.
2. Choose **Live telemetry** from the main menu and press **Connect**. The page uses its prefilled local API demo account and shows simulator values with quality codes.
3. Choose **Plant schematic** to show the 2D plant and the indicative what-if overlay.

The building geometry is generated from the seed ontology and is marked schematic. Dashboard values, alarms, and controller health still use demo fixtures; the Live telemetry page is the working simulator-to-API path.

If the web page was opened before rebuilding, refresh it once to update its cached PWA assets.
