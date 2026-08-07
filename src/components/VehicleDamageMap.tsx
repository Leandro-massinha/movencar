import { AlertTriangle } from "lucide-react";
import type { DamageLocation } from "../services/workshop";

type DamageLike = {
  id: string;
  location: DamageLocation;
};

type VehicleDamageMapProps = {
  damages: DamageLike[];
  disabled?: boolean;
  locationLabels: Record<DamageLocation, string>;
  onSelect: (location: DamageLocation) => void;
};

type Hotspot = {
  location: DamageLocation;
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  marker: [number, number];
};

const hotspots: Hotspot[] = [
  { location: "REAR_BUMPER", x: 24, y: 130, width: 52, height: 122, rx: 22, marker: [48, 190] },
  { location: "TRUNK_LID", x: 68, y: 112, width: 112, height: 156, rx: 22, marker: [122, 190] },
  { location: "REAR_GLASS", x: 178, y: 104, width: 72, height: 170, rx: 18, marker: [214, 190] },
  { location: "ROOF", x: 246, y: 96, width: 156, height: 184, rx: 24, marker: [324, 190] },
  { location: "WINDSHIELD", x: 400, y: 103, width: 64, height: 172, rx: 18, marker: [432, 190] },
  { location: "HOOD", x: 458, y: 110, width: 106, height: 158, rx: 28, marker: [510, 190] },
  { location: "FRONT_BUMPER", x: 556, y: 128, width: 58, height: 126, rx: 24, marker: [588, 190] },

  { location: "REAR_LEFT_QUARTER", x: 112, y: 61, width: 136, height: 60, rx: 18, marker: [178, 90] },
  { location: "REAR_RIGHT_QUARTER", x: 112, y: 259, width: 136, height: 60, rx: 18, marker: [178, 290] },
  { location: "REAR_LEFT_DOOR", x: 246, y: 55, width: 112, height: 66, rx: 16, marker: [302, 87] },
  { location: "REAR_RIGHT_DOOR", x: 246, y: 259, width: 112, height: 66, rx: 16, marker: [302, 292] },
  { location: "FRONT_LEFT_DOOR", x: 356, y: 55, width: 104, height: 66, rx: 16, marker: [406, 87] },
  { location: "FRONT_RIGHT_DOOR", x: 356, y: 259, width: 104, height: 66, rx: 16, marker: [406, 292] },
  { location: "FRONT_LEFT_FENDER", x: 456, y: 63, width: 98, height: 60, rx: 20, marker: [504, 91] },
  { location: "FRONT_RIGHT_FENDER", x: 456, y: 257, width: 98, height: 60, rx: 20, marker: [504, 289] },

  { location: "LEFT_MIRROR", x: 382, y: 25, width: 52, height: 35, rx: 12, marker: [408, 42] },
  { location: "RIGHT_MIRROR", x: 382, y: 320, width: 52, height: 35, rx: 12, marker: [408, 338] },

  { location: "REAR_LEFT_WHEEL", x: 105, y: 73, width: 66, height: 42, rx: 18, marker: [138, 94] },
  { location: "REAR_RIGHT_WHEEL", x: 105, y: 265, width: 66, height: 42, rx: 18, marker: [138, 286] },
  { location: "FRONT_LEFT_WHEEL", x: 459, y: 73, width: 72, height: 42, rx: 18, marker: [495, 94] },
  { location: "FRONT_RIGHT_WHEEL", x: 459, y: 265, width: 72, height: 42, rx: 18, marker: [495, 286] },
];

const visualLocations = new Set<DamageLocation>(
  hotspots.map((hotspot) => hotspot.location),
);

export function VehicleDamageMap({
  damages,
  disabled = false,
  locationLabels,
  onSelect,
}: VehicleDamageMapProps) {
  const countFor = (location: DamageLocation) =>
    damages.filter((damage) => damage.location === location).length;

  const fallbackLocations = (Object.keys(locationLabels) as DamageLocation[]).filter(
    (location) => !visualLocations.has(location),
  );

  const activate = (location: DamageLocation) => {
    if (!disabled) onSelect(location);
  };

  return (
    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="overflow-hidden rounded-xl border bg-white p-3 sm:p-5">
        <div className="mx-auto max-w-5xl rounded-xl bg-slate-50 px-2 py-3 sm:px-5 sm:py-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>TRASEIRA</span>
            <span>Toque diretamente na peça do carro</span>
            <span>DIANTEIRA</span>
          </div>

          <svg
            viewBox="0 0 640 380"
            role="img"
            aria-label="Vista superior realista e interativa do veículo para registrar avarias"
            className="h-auto w-full"
          >
            <image
              href="/vehicle-damage-top.svg"
              x="0"
              y="0"
              width="640"
              height="380"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            />

            {hotspots.map((hotspot) => {
              const count = countFor(hotspot.location);
              const label = locationLabels[hotspot.location];

              return (
                <g
                  key={hotspot.location}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  aria-label={`${label}${count ? `, ${count} ${count === 1 ? "avaria registrada" : "avarias registradas"}` : ", sem avarias registradas"}`}
                  onClick={() => activate(hotspot.location)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activate(hotspot.location);
                    }
                  }}
                  className={disabled ? "cursor-not-allowed" : "cursor-pointer outline-none"}
                >
                  <rect
                    x={hotspot.x}
                    y={hotspot.y}
                    width={hotspot.width}
                    height={hotspot.height}
                    rx={hotspot.rx ?? 12}
                    fill={count ? "#fde68a" : "#ffffff"}
                    fillOpacity={count ? 0.52 : 0.01}
                    stroke={count ? "#eab308" : "transparent"}
                    strokeWidth={count ? 2.5 : 1}
                    className={count ? "transition" : "transition hover:fill-amber-100 hover:fill-opacity-30 hover:stroke-amber-400"}
                    vectorEffect="non-scaling-stroke"
                  />

                  {count > 0 && (
                    <g aria-hidden="true">
                      <circle
                        cx={hotspot.marker[0]}
                        cy={hotspot.marker[1]}
                        r="12"
                        fill="#facc15"
                        stroke="#ffffff"
                        strokeWidth="3"
                      />
                      <text
                        x={hotspot.marker[0]}
                        y={hotspot.marker[1] + 4}
                        textAnchor="middle"
                        className="fill-black text-[11px] font-bold"
                      >
                        {count > 9 ? "9+" : count}
                      </text>
                    </g>
                  )}

                  <title>{label}</title>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full border border-slate-400 bg-white" /> Sem avaria
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-600" /> Área com avaria
          </span>
          <span className="text-slate-500">Passe o mouse ou toque na peça para selecionar.</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800">Outras áreas</h3>
        <p className="mt-1 text-xs text-slate-500">
          Use esta lista para vidros, áreas internas ou pontos que não aparecem claramente na vista superior.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {fallbackLocations.map((location) => {
            const count = countFor(location);
            return (
              <button
                key={location}
                type="button"
                disabled={disabled}
                onClick={() => activate(location)}
                className="flex min-h-11 items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{locationLabels[location]}</span>
                {count > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
