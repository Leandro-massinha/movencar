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

type Region = {
  location: DamageLocation;
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
};

const regions: Region[] = [
  { location: "FRONT_BUMPER", x: 104, y: 20, width: 112, height: 18, rx: 8 },
  { location: "HOOD", x: 112, y: 42, width: 96, height: 70, rx: 14 },
  { location: "WINDSHIELD", x: 118, y: 116, width: 84, height: 32, rx: 8 },
  { location: "ROOF", x: 118, y: 152, width: 84, height: 86, rx: 14 },
  { location: "REAR_GLASS", x: 118, y: 242, width: 84, height: 32, rx: 8 },
  { location: "TRUNK_LID", x: 112, y: 278, width: 96, height: 58, rx: 12 },
  { location: "REAR_BUMPER", x: 104, y: 340, width: 112, height: 18, rx: 8 },
  { location: "FRONT_LEFT_FENDER", x: 70, y: 48, width: 38, height: 58, rx: 12 },
  { location: "FRONT_RIGHT_FENDER", x: 212, y: 48, width: 38, height: 58, rx: 12 },
  { location: "FRONT_LEFT_DOOR", x: 70, y: 112, width: 42, height: 82, rx: 10 },
  { location: "FRONT_RIGHT_DOOR", x: 208, y: 112, width: 42, height: 82, rx: 10 },
  { location: "REAR_LEFT_DOOR", x: 70, y: 198, width: 42, height: 82, rx: 10 },
  { location: "REAR_RIGHT_DOOR", x: 208, y: 198, width: 42, height: 82, rx: 10 },
  { location: "REAR_LEFT_QUARTER", x: 70, y: 284, width: 38, height: 48, rx: 12 },
  { location: "REAR_RIGHT_QUARTER", x: 212, y: 284, width: 38, height: 48, rx: 12 },
  { location: "LEFT_MIRROR", x: 54, y: 120, width: 14, height: 24, rx: 7 },
  { location: "RIGHT_MIRROR", x: 252, y: 120, width: 14, height: 24, rx: 7 },
  { location: "LEFT_FRONT_GLASS", x: 114, y: 116, width: 4, height: 70, rx: 2 },
  { location: "RIGHT_FRONT_GLASS", x: 202, y: 116, width: 4, height: 70, rx: 2 },
  { location: "LEFT_REAR_GLASS", x: 114, y: 190, width: 4, height: 70, rx: 2 },
  { location: "RIGHT_REAR_GLASS", x: 202, y: 190, width: 4, height: 70, rx: 2 },
  { location: "FRONT_LEFT_WHEEL", x: 48, y: 62, width: 18, height: 42, rx: 7 },
  { location: "FRONT_RIGHT_WHEEL", x: 254, y: 62, width: 18, height: 42, rx: 7 },
  { location: "REAR_LEFT_WHEEL", x: 48, y: 286, width: 18, height: 42, rx: 7 },
  { location: "REAR_RIGHT_WHEEL", x: 254, y: 286, width: 18, height: 42, rx: 7 },
];

const visualLocations = new Set<DamageLocation>(regions.map((region) => region.location));

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
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-xl border bg-slate-50 p-3 sm:p-5">
        <div className="mx-auto max-w-md">
          <svg
            viewBox="0 0 320 380"
            role="img"
            aria-label="Vista superior interativa do veículo para registrar avarias"
            className="h-auto w-full"
          >
            <path
              d="M112 28 C92 42 82 78 82 108 L82 286 C82 326 104 350 132 358 L188 358 C216 350 238 326 238 286 L238 108 C238 78 228 42 208 28 Z"
              className="fill-white stroke-slate-300"
              strokeWidth="2"
            />
            {regions.map((region) => {
              const count = countFor(region.location);
              const label = locationLabels[region.location];
              return (
                <g
                  key={region.location}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  aria-label={`${label}${count ? `, ${count} ${count === 1 ? "avaria registrada" : "avarias registradas"}` : ", sem avarias registradas"}`}
                  onClick={() => activate(region.location)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      activate(region.location);
                    }
                  }}
                  className={disabled ? "cursor-not-allowed" : "cursor-pointer outline-none"}
                >
                  <rect
                    x={region.x}
                    y={region.y}
                    width={region.width}
                    height={region.height}
                    rx={region.rx ?? 4}
                    className={
                      count
                        ? "fill-amber-100 stroke-amber-600 transition hover:fill-amber-200 focus:fill-amber-200"
                        : "fill-white stroke-slate-400 transition hover:fill-slate-100 focus:fill-slate-100"
                    }
                    strokeWidth={count ? 2.5 : 1.5}
                  />
                  {count > 0 && (
                    <g aria-hidden="true">
                      <circle
                        cx={region.x + region.width - 3}
                        cy={region.y + 3}
                        r="10"
                        className="fill-red-600"
                      />
                      <text
                        x={region.x + region.width - 3}
                        y={region.y + 7}
                        textAnchor="middle"
                        className="fill-white text-[11px] font-bold"
                      >
                        {count > 9 ? "9+" : count}
                      </text>
                    </g>
                  )}
                  <title>{label}</title>
                </g>
              );
            })}
            <text x="160" y="13" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
              DIANTEIRA
            </text>
            <text x="160" y="376" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
              TRASEIRA
            </text>
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded border border-slate-400 bg-white" /> Sem avaria registrada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-700" /> Área com avaria
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800">Outras áreas</h3>
        <p className="mt-1 text-xs text-slate-500">
          Use esta lista para áreas que não aparecem na vista superior.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {fallbackLocations.map((location) => {
            const count = countFor(location);
            return (
              <button
                key={location}
                type="button"
                disabled={disabled}
                onClick={() => activate(location)}
                className="flex min-h-11 items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{locationLabels[location]}</span>
                {count > 0 && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
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
