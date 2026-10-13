import { lazy, Suspense, useState } from 'react';
import { Header } from '../components/Header';
import { parseTwinLayout } from 'packages-twin-core';
import seedLayout from '../../../../data/seed/twin-layout.json';

const TwinCanvas = lazy(() => import('packages-twin-3d').then((module) => ({ default: module.TwinCanvas })));
const layout = parseTwinLayout(seedLayout);
const floors = [...layout.floors].sort((a, b) => b.elevation - a.elevation);
const comfortBands = {};

export function BuildingView() {
  const [focusedFloorId, setFocusedFloorId] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const visibleFloors = focusedFloorId ? floors.filter((floor) => floor.id === focusedFloorId) : floors;

  return (
    <div className="min-h-screen bg-surface-base">
      <Header breadcrumb={[{ label: 'Dashboard', href: '/' }, { label: 'Building twin' }]} />
      <main className="px-4 pb-6 pt-[calc(var(--header-height)+1rem)] lg:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-content-tertiary">Spatial overview</p>
            <h1 className="text-2xl font-semibold text-content-primary">Building twin</h1>
            <p className="text-sm text-content-tertiary">Schematic layout, generated from site assets. Not to scale.</p>
          </div>
          <div className="flex gap-2" role="group" aria-label="View mode">
            <button type="button" onClick={() => setShowPlan(false)} aria-pressed={!showPlan} className={`rounded-md border px-4 py-2 text-sm ${!showPlan ? 'bg-surface-sunken text-content-primary' : 'text-content-tertiary'}`}>3D view</button>
            <button type="button" onClick={() => setShowPlan(true)} aria-pressed={showPlan} className={`rounded-md border px-4 py-2 text-sm ${showPlan ? 'bg-surface-sunken text-content-primary' : 'text-content-tertiary'}`}>Floor plans</button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-default bg-surface-elevated p-3" aria-label="Floors">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold text-content-primary">
              <span>Floors</span><span className="text-content-tertiary">{floors.length}</span>
            </div>
            <div className="space-y-2">
              {floors.map((floor) => {
                const count = Object.values(layout.anchors).filter((anchor) => anchor.floor === floor.id).length;
                const active = focusedFloorId === floor.id;
                return (
                  <button key={floor.id} type="button" onClick={() => setFocusedFloorId(active ? null : floor.id)} aria-pressed={active} className={`flex w-full items-center justify-between rounded-md border px-3 py-3 text-left text-sm ${active ? 'border-chilled bg-state-selected text-content-primary' : 'border-default text-content-secondary hover:bg-state-hover'}`}>
                    <span>{floor.name}</span><span className="text-xs text-content-tertiary">{count} assets</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-content-tertiary">Select a floor to focus it. Drag to orbit, scroll to zoom, and use Expand to separate floors.</p>
          </aside>

          <section className="relative min-h-[520px] overflow-hidden rounded-lg border border-default bg-[#111f2b]" aria-label={showPlan ? 'Floor plans' : '3D building view'}>
            {showPlan ? (
              <div className="grid max-h-[70vh] gap-3 overflow-auto p-4 md:grid-cols-2">
                {visibleFloors.map((floor) => (
                  <div key={floor.id} className="rounded-lg border border-white/15 bg-[#1b3440] p-3 text-white">
                    <h2 className="mb-2 text-sm font-semibold">{floor.name}</h2>
                    <svg className="w-full" viewBox={`0 0 ${floor.footprint.w} ${floor.footprint.h}`} role="img" aria-label={`${floor.name} schematic plan`}>
                      <rect width={floor.footprint.w} height={floor.footprint.h} fill="#132630" />
                      {layout.zones.filter((zone) => zone.floor === floor.id).map((zone) => (
                        <g key={zone.id}>
                          <rect x={zone.rect[0]} y={zone.rect[1]} width={zone.rect[2]} height={zone.rect[3]} fill="#31535c" stroke="#a8c5c8" strokeWidth="0.5" />
                          <text x={zone.rect[0] + 2} y={zone.rect[1] + 4} fill="white" fontSize="2.5">{zone.spaceType}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                ))}
              </div>
            ) : (
              <Suspense fallback={<div className="grid h-[70vh] place-items-center text-white">Loading building view…</div>}>
                <div className="h-[70vh] min-h-[520px]">
                  <TwinCanvas layout={layout} comfortBands={comfortBands} focusedFloorId={focusedFloorId} />
                </div>
              </Suspense>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
