import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
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

type VehicleView = "TOP" | "FRONT" | "REAR" | "LEFT" | "RIGHT";

type Hotspot = {
  location: DamageLocation;
  points: string;
  marker: [number, number];
};

type ViewConfig = {
  id: VehicleView;
  label: string;
  viewBox: string;
  hotspots: Hotspot[];
};

const IMAGE_PATH = "/assets/vehicle-damage-map.webp";

const viewConfigs: ViewConfig[] = [
  {
    id: "TOP",
    label: "Superior",
    viewBox: "35 190 1165 455",
    hotspots: [
      { location: "REAR_BUMPER", points: "55,260 105,225 145,250 140,580 100,615 55,585", marker: [92, 425] },
      { location: "TRUNK_LID", points: "120,285 205,255 315,275 315,570 205,600 120,575", marker: [215, 425] },
      { location: "REAR_GLASS", points: "190,290 320,278 350,305 350,545 320,568 190,558", marker: [270, 425] },
      { location: "ROOF", points: "350,280 700,280 725,305 725,545 700,572 350,572", marker: [535, 425] },
      { location: "WINDSHIELD", points: "700,285 860,292 900,330 900,532 860,566 700,570", marker: [805, 425] },
      { location: "HOOD", points: "885,290 1085,288 1142,322 1142,562 1085,598 885,572", marker: [1012, 425] },
      { location: "FRONT_BUMPER", points: "1110,272 1162,252 1190,288 1190,568 1162,602 1110,582", marker: [1154, 425] },
      { location: "REAR_LEFT_QUARTER", points: "120,250 325,225 345,285 120,300", marker: [235, 255] },
      { location: "REAR_RIGHT_QUARTER", points: "120,580 345,565 325,625 120,605", marker: [235, 595] },
      { location: "REAR_LEFT_DOOR", points: "325,225 545,220 545,280 345,285", marker: [435, 250] },
      { location: "REAR_RIGHT_DOOR", points: "345,565 545,570 545,630 325,625", marker: [435, 600] },
      { location: "FRONT_LEFT_DOOR", points: "545,220 735,225 715,290 545,280", marker: [635, 250] },
      { location: "FRONT_RIGHT_DOOR", points: "545,570 715,560 735,625 545,630", marker: [635, 600] },
      { location: "FRONT_LEFT_FENDER", points: "735,225 940,245 900,305 715,290", marker: [830, 265] },
      { location: "FRONT_RIGHT_FENDER", points: "715,560 900,545 940,605 735,625", marker: [830, 585] },
      { location: "LEFT_MIRROR", points: "720,205 790,205 815,245 760,270", marker: [770, 235] },
      { location: "RIGHT_MIRROR", points: "720,605 790,580 815,620 760,650", marker: [770, 615] },
    ],
  },
  {
    id: "FRONT",
    label: "Dianteira",
    viewBox: "20 805 300 205",
    hotspots: [
      { location: "FRONT_BUMPER", points: "63,950 275,950 285,1002 52,1002", marker: [168, 978] },
      { location: "HOOD", points: "83,872 254,872 268,941 66,941", marker: [169, 907] },
      { location: "FRONT_LEFT_FENDER", points: "48,886 92,875 80,958 39,956", marker: [63, 916] },
      { location: "FRONT_RIGHT_FENDER", points: "245,875 289,886 298,956 257,958", marker: [275, 916] },
    ],
  },
  {
    id: "REAR",
    label: "Traseira",
    viewBox: "323 805 280 205",
    hotspots: [
      { location: "REAR_BUMPER", points: "354,951 568,951 577,1003 344,1003", marker: [461, 979] },
      { location: "TRUNK_LID", points: "375,875 548,875 558,945 365,945", marker: [462, 909] },
      { location: "REAR_LEFT_QUARTER", points: "344,887 388,875 378,958 338,958", marker: [358, 917] },
      { location: "REAR_RIGHT_QUARTER", points: "536,875 580,887 585,958 546,958", marker: [565, 917] },
    ],
  },
  {
    id: "LEFT",
    label: "Lateral esquerda",
    viewBox: "600 805 470 205",
    hotspots: [
      { location: "REAR_LEFT_QUARTER", points: "615,888 715,872 743,955 620,958", marker: [670, 915] },
      { location: "REAR_LEFT_DOOR", points: "735,858 834,855 841,956 748,956", marker: [788, 907] },
      { location: "FRONT_LEFT_DOOR", points: "834,855 930,858 935,956 841,956", marker: [885, 907] },
      { location: "FRONT_LEFT_FENDER", points: "930,868 1038,890 1050,955 935,956", marker: [985, 915] },
      { location: "LEFT_MIRROR", points: "919,845 948,842 954,867 925,872", marker: [938, 856] },
      { location: "REAR_LEFT_WHEEL", points: "652,926 711,922 720,991 648,991", marker: [684, 957] },
      { location: "FRONT_LEFT_WHEEL", points: "958,925 1022,924 1030,991 955,991", marker: [992, 957] },
    ],
  },
  {
    id: "RIGHT",
    label: "Lateral direita",
    viewBox: "1052 805 470 205",
    hotspots: [
      { location: "REAR_RIGHT_QUARTER", points: "1067,890 1167,870 1194,956 1070,958", marker: [1123, 915] },
      { location: "REAR_RIGHT_DOOR", points: "1188,858 1287,855 1294,956 1199,956", marker: [1240, 907] },
      { location: "FRONT_RIGHT_DOOR", points: "1287,855 1383,858 1388,956 1294,956", marker: [1338, 907] },
      { location: "FRONT_RIGHT_FENDER", points: "1383,868 1490,890 1502,955 1388,956", marker: [1438, 915] },
      { location: "RIGHT_MIRROR", points: "1370,845 1402,842 1408,868 1378,872", marker: [1390, 856] },
      { location: "REAR_RIGHT_WHEEL", points: "1105,926 1164,922 1173,991 1102,991", marker: [1137, 957] },
      { location: "FRONT_RIGHT_WHEEL", points: "1410,925 1475,924 1483,991 1408,991", marker: [1445, 957] },
    ],
  },
];

const visualLocations = new Set<DamageLocation>(
  viewConfigs.flatMap((view) => view.hotspots.map((hotspot) => hotspot.location)),
);

export function VehicleDamageMap({
  damages,
  disabled = false,
  locationLabels,
  onSelect,
}: VehicleDamageMapProps) {
  const [activeView, setActiveView] = useState<VehicleView>("TOP");

  const countFor = (location: DamageLocation) =>
    damages.filter((damage) => damage.location === location).length;

  const activeConfig = viewConfigs.find((view) => view.id === activeView) ?? viewConfigs[0];

  const fallbackLocations = (Object.keys(locationLabels) as DamageLocation[]).filter(
    (location) => !visualLocations.has(location),
  );

  const viewCounts = useMemo(() => {
    return Object.fromEntries(
      viewConfigs.map((view) => {
        const uniqueLocations = new Set(view.hotspots.map((hotspot) => hotspot.location));
        const total = [...uniqueLocations].reduce((sum, location) => sum + countFor(location), 0);
        return [view.id, total];
      }),
    ) as Record<VehicleView, number>;
  }, [damages]);

  const activate = (location: DamageLocation) => {
    if (!disabled) onSelect(location);
  };

  return (
    <div className="mt-4">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {viewConfigs.map((view) => {
          const selected = view.id === activeView;
          const count = viewCounts[view.id];

          return (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={`relative overflow-hidden rounded-xl border bg-white p-1.5 text-left transition ${
                selected
                  ? "border-amber-400 ring-2 ring-amber-200"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              aria-pressed={selected}
            >
              <div className="overflow-hidden rounded-lg bg-slate-50">
                <svg viewBox={view.viewBox} className="h-20 w-full" aria-hidden="true">
                  <image href={IMAGE_PATH} x="0" y="0" width="1536" height="1024" />
                </svg>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 px-1 pb-0.5">
                <span className="truncate text-xs font-semibold text-slate-700">{view.label}</span>
                {count > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white p-2 sm:p-3">
        <div className="relative mx-auto w-full overflow-hidden rounded-xl bg-slate-50">
          <svg
            viewBox={activeConfig.viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto max-h-[620px] w-full"
            aria-label={`${activeConfig.label} interativa do veículo`}
          >
            <image
              href={IMAGE_PATH}
              x="0"
              y="0"
              width="1536"
              height="1024"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            />

            {activeConfig.hotspots.map((hotspot) => {
              const count = countFor(hotspot.location);
              const label = locationLabels[hotspot.location];

              return (
                <g
                  key={`${activeConfig.id}-${hotspot.location}`}
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
                  <polygon
                    points={hotspot.points}
                    fill={count ? "#facc15" : "#ffffff"}
                    fillOpacity={count ? 0.28 : 0.001}
                    stroke={count ? "#eab308" : "transparent"}
                    strokeWidth={count ? 4 : 2}
                    className="transition hover:fill-amber-200/30 hover:stroke-amber-400 focus:fill-amber-200/30 focus:stroke-amber-400"
                    vectorEffect="non-scaling-stroke"
                  />

                  {count > 0 && (
                    <g aria-hidden="true">
                      <circle
                        cx={hotspot.marker[0]}
                        cy={hotspot.marker[1]}
                        r="18"
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="5"
                        opacity="0.8"
                      >
                        <animate attributeName="r" values="16;28;16" dur="1.35s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.85;0.15;0.85" dur="1.35s" repeatCount="indefinite" />
                      </circle>
                      <circle
                        cx={hotspot.marker[0]}
                        cy={hotspot.marker[1]}
                        r="16"
                        fill="#facc15"
                        stroke="#ffffff"
                        strokeWidth="4"
                      />
                      <text
                        x={hotspot.marker[0]}
                        y={hotspot.marker[1] + 6}
                        textAnchor="middle"
                        className="fill-black text-[16px] font-bold"
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
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-slate-400 bg-white" /> Sem avaria
        </span>
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="size-3.5 text-amber-600" /> Área com avaria
        </span>
        <span className="text-slate-500">Escolha uma vista e clique diretamente na peça.</span>
      </div>

      {fallbackLocations.length > 0 && (
        <div className="mt-5 rounded-xl border bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Outras áreas</h3>
          <p className="mt-1 text-xs text-slate-500">
            Use estes atalhos para áreas internas ou pontos sem hotspot dedicado nas vistas do veículo.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      )}
    </div>
  );
}
