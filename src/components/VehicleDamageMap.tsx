import { AlertTriangle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
  imagePath: string;
  hotspots: Hotspot[];
};

const VIEW_BOX = "0 0 1536 1024";

const viewConfigs: ViewConfig[] = [
  {
    id: "TOP",
    label: "Superior",
    imagePath: "/assets/damage-views/top.webp",
    hotspots: [
      { location: "FRONT_BUMPER", points: "610,145 925,145 970,205 565,205", marker: [768, 178] },
      { location: "HOOD", points: "580,205 955,205 920,390 615,390", marker: [768, 292] },
      { location: "WINDSHIELD", points: "620,390 915,390 885,475 650,475", marker: [768, 430] },
      { location: "ROOF", points: "650,475 885,475 870,650 665,650", marker: [768, 565] },
      { location: "REAR_GLASS", points: "665,650 870,650 845,735 690,735", marker: [768, 690] },
      { location: "TRUNK_LID", points: "690,735 845,735 875,830 660,830", marker: [768, 785] },
      { location: "REAR_BUMPER", points: "650,830 885,830 920,875 615,875", marker: [768, 850] },

      { location: "FRONT_LEFT_FENDER", points: "520,230 610,205 615,390 535,420 500,340", marker: [555, 310] },
      { location: "FRONT_RIGHT_FENDER", points: "925,205 1015,230 1035,340 1000,420 920,390", marker: [980, 310] },
      { location: "FRONT_LEFT_DOOR", points: "535,420 650,390 650,545 540,555", marker: [590, 480] },
      { location: "FRONT_RIGHT_DOOR", points: "885,390 1000,420 995,555 885,545", marker: [945, 480] },
      { location: "REAR_LEFT_DOOR", points: "540,555 650,545 665,680 555,685", marker: [605, 615] },
      { location: "REAR_RIGHT_DOOR", points: "885,545 995,555 980,685 870,680", marker: [930, 615] },
      { location: "REAR_LEFT_QUARTER", points: "555,685 665,680 690,735 660,830 560,800", marker: [610, 745] },
      { location: "REAR_RIGHT_QUARTER", points: "870,680 980,685 975,800 875,830 845,735", marker: [925, 745] },

      { location: "LEFT_MIRROR", points: "505,400 555,385 575,430 520,445", marker: [535, 415] },
      { location: "RIGHT_MIRROR", points: "980,385 1030,400 1015,445 960,430", marker: [1000, 415] },

      { location: "FRONT_LEFT_WHEEL", points: "475,250 525,250 535,365 485,365", marker: [505, 308] },
      { location: "FRONT_RIGHT_WHEEL", points: "1010,250 1060,250 1050,365 1000,365", marker: [1035, 308] },
      { location: "REAR_LEFT_WHEEL", points: "490,695 540,695 545,805 495,805", marker: [518, 750] },
      { location: "REAR_RIGHT_WHEEL", points: "290,545 485,545 485,790 290,790", marker: [388, 668] },
    ],
  },
  {
    id: "FRONT",
    label: "Dianteira",
    imagePath: "/assets/damage-views/front.webp",
    hotspots: [
      {
        location: "FRONT_LEFT_HEADLIGHT",
        points: "365,430 570,390 620,475 390,520",
        marker: [490, 455],
      },
      {
        location: "FRONT_RIGHT_HEADLIGHT",
        points: "965,390 1170,430 1145,520 915,475",
        marker: [1045, 455],
      },
      { location: "HOOD", points: "440,365 1095,365 1015,555 520,555", marker: [768, 455] },
      { location: "FRONT_BUMPER", points: "350,610 1185,610 1150,820 385,820", marker: [768, 720] },
      { location: "FRONT_LEFT_FENDER", points: "300,410 520,365 520,640 330,675", marker: [420, 520] },
      { location: "FRONT_RIGHT_FENDER", points: "1015,365 1235,410 1205,675 1015,640", marker: [1115, 520] },
      { location: "WINDSHIELD", points: "520,230 1015,230 1095,365 440,365", marker: [768, 300] },
      { location: "LEFT_MIRROR", points: "285,330 390,315 410,365 300,385", marker: [345, 347] },
      { location: "RIGHT_MIRROR", points: "1145,315 1250,330 1235,385 1125,365", marker: [1190, 347] },
    ],
  },
  {
    id: "REAR",
    label: "Traseira",
    imagePath: "/assets/damage-views/rear.webp",
    hotspots: [
      {
        location: "REAR_LEFT_TAILLIGHT",
        points: "340,435 520,410 540,530 350,550",
        marker: [435, 480],
      },
      {
        location: "REAR_RIGHT_TAILLIGHT",
        points: "1015,410 1195,435 1185,550 995,530",
        marker: [1100, 480],
      },
      { location: "REAR_GLASS", points: "490,230 1045,230 1090,400 445,400", marker: [768, 310] },
      { location: "TRUNK_LID", points: "430,400 1105,400 1080,600 455,600", marker: [768, 500] },
      { location: "REAR_BUMPER", points: "350,615 1185,615 1160,815 375,815", marker: [768, 710] },
      { location: "REAR_LEFT_QUARTER", points: "300,385 455,400 455,690 330,720", marker: [390, 540] },
      { location: "REAR_RIGHT_QUARTER", points: "1080,400 1235,385 1205,720 1080,690", marker: [1145, 540] },
    ],
  },
  {
    id: "LEFT",
    label: "Lateral esquerda",
    imagePath: "/assets/damage-views/left.webp",
    hotspots: [
      {
        location: "FRONT_LEFT_FENDER",
        points: "145,470 445,445 500,690 455,700 439,529 235,530 243,690 45,680",
        marker: [340, 540],
      },
      {
        location: "FRONT_LEFT_DOOR",
        points: "485,485 815,330 815,680 490,690",
        marker: [650, 520],
      },
      {
        location: "REAR_LEFT_DOOR",
        points: "820,340 1090,340 1015,680 820,680",
        marker: [940, 520],
      },
      {
        location: "REAR_LEFT_QUARTER",
        points: "1112,379 1410,435 1385,600 1255,685 1255,520 1090,530 1050,600",
        marker: [1210, 510],
      },
      {
        location: "LEFT_FRONT_GLASS",
        points: "500,350 805,330 805,470 500,475",
        marker: [655, 405],
      },
      {
        location: "LEFT_REAR_GLASS",
        points: "820,340 1080,345 1025,470 820,470",
        marker: [930, 405],
      },
      {
        location: "LEFT_MIRROR",
        points: "510,405 615,405 610,465 445,475",
        marker: [535, 440],
      },
      {
        location: "FRONT_LEFT_WHEEL",
        points: "255,545 435,545 440,790 240,790",
        marker: [340, 668],
      },
      {
        location: "REAR_LEFT_WHEEL",
        points: "1080,545 1235,545 1252,749 1000,759",
        marker: [1120, 650],
      },
    ],
  },
  {
    id: "RIGHT",
    label: "Lateral direita",
    imagePath: "/assets/damage-views/right.webp",
    hotspots: [
      {
        location: "REAR_RIGHT_QUARTER",
        points: "125,455 399,375 450,525 295,600 285,690 230,620 105,680",
        marker: [290, 540],
      },
      {
        location: "REAR_RIGHT_DOOR",
        points: "450,370 720,350 720,685 450,690",
        marker: [585, 520],
      },
      {
        location: "FRONT_RIGHT_DOOR",
        points: "720,350 1000,390 1050,685 720,685",
        marker: [885, 525],
      },
      {
        location: "FRONT_RIGHT_FENDER",
        points: "1000,435 1340,465 1300,650 1240,550 1225,535 1060,565 1050,585",
        marker: [1185, 530],
      },
      {
        location: "RIGHT_REAR_GLASS",
        points: "455,370 710,355 710,475 465,475",
        marker: [585, 415],
      },
      {
        location: "RIGHT_FRONT_GLASS",
        points: "720,355 990,395 1010,480 720,475",
        marker: [865, 420],
      },
      {
        location: "RIGHT_MIRROR",
        points: "905,405 1050,405 1050,465 900,475",
        marker: [975, 435],
      },
      {
        location: "REAR_RIGHT_WHEEL",
        points: "290,545 485,545 485,790 290,790",
        marker: [388, 668],
      },
      {
        location: "FRONT_RIGHT_WHEEL",
        points: "1070,549 1280,549 1280,790 1070,790",
        marker: [1175, 670],
      },
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

  const countFor = useCallback(
    (location: DamageLocation) =>
      damages.filter((damage) => damage.location === location).length,
    [damages],
  );

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
  }, [countFor]);

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
                <img
                  src={view.imagePath}
                  alt=""
                  className="h-20 w-full object-contain"
                  draggable={false}
                />
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
        <div className="relative mx-auto aspect-[3/2] w-full max-w-[1200px] overflow-hidden rounded-xl bg-slate-50">
          <img
            src={activeConfig.imagePath}
            alt={`${activeConfig.label} do veículo`}
            className="absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
          />

          <svg
            viewBox={VIEW_BOX}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
            aria-label={`${activeConfig.label} interativa do veículo`}
          >
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
                    fillOpacity={count ? 0.3 : 0.001}
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
