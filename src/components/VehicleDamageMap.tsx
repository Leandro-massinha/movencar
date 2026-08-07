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
  points: string;
  marker: [number, number];
};

// Coordenadas sobre a imagem 1536x1024. O carro ocupa aproximadamente
// x=55..1180 e y=205..640. Mantemos a imagem real como fundo e usamos
// apenas esta camada SVG transparente para interação.
const hotspots: Hotspot[] = [
  { location: "REAR_BUMPER", points: "58,250 110,218 145,245 140,588 105,625 58,595", marker: [95, 420] },
  { location: "TRUNK_LID", points: "120,275 205,250 320,270 315,585 205,610 120,580", marker: [215, 430] },
  { location: "REAR_GLASS", points: "190,286 320,275 350,300 350,545 320,570 190,560", marker: [270, 425] },
  { location: "ROOF", points: "350,278 705,278 725,305 725,548 705,575 350,575", marker: [535, 425] },
  { location: "WINDSHIELD", points: "700,282 860,292 900,330 900,535 860,568 700,572", marker: [805, 425] },
  { location: "HOOD", points: "885,288 1090,285 1145,320 1145,565 1090,600 885,575", marker: [1015, 425] },
  { location: "FRONT_BUMPER", points: "1110,270 1165,250 1190,285 1190,570 1165,605 1110,585", marker: [1155, 425] },

  { location: "REAR_LEFT_QUARTER", points: "120,250 325,225 345,285 120,300", marker: [235, 255] },
  { location: "REAR_RIGHT_QUARTER", points: "120,580 345,565 325,625 120,605", marker: [235, 595] },
  { location: "REAR_LEFT_DOOR", points: "325,225 545,220 545,280 345,285", marker: [435, 250] },
  { location: "REAR_RIGHT_DOOR", points: "345,565 545,570 545,630 325,625", marker: [435, 600] },
  { location: "FRONT_LEFT_DOOR", points: "545,220 735,225 715,290 545,280", marker: [635, 250] },
  { location: "FRONT_RIGHT_DOOR", points: "545,570 715,560 735,625 545,630", marker: [635, 600] },
  { location: "FRONT_LEFT_FENDER", points: "735,225 940,245 900,305 715,290", marker: [830, 265] },
  { location: "FRONT_RIGHT_FENDER", points: "715,560 900,545 940,605 735,625", marker: [830, 585] },

  { location: "LEFT_MIRROR", points: "720,208 790,205 815,245 760,270", marker: [770, 235] },
  { location: "RIGHT_MIRROR", points: "720,605 790,580 815,620 760,650", marker: [770, 615] },

  { location: "REAR_LEFT_WHEEL", points: "200,230 295,225 305,270 210,280", marker: [255, 250] },
  { location: "REAR_RIGHT_WHEEL", points: "210,575 305,585 295,630 200,625", marker: [255, 605] },
  { location: "FRONT_LEFT_WHEEL", points: "925,245 1040,250 1050,305 940,305", marker: [995, 275] },
  { location: "FRONT_RIGHT_WHEEL", points: "940,545 1050,545 1040,605 925,605", marker: [995, 575] },
];

const visualLocations = new Set<DamageLocation>(hotspots.map((hotspot) => hotspot.location));

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
    <div className="mt-4">
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="relative mx-auto w-full max-w-[1536px]">
          <img
            src="/assets/vehicle-damage-map.webp"
            alt="Mapa visual do veículo para registro de avarias"
            className="block h-auto w-full select-none"
            draggable={false}
          />

          <svg
            viewBox="0 0 1536 1024"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
            aria-label="Áreas interativas do veículo"
          >
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
                        r="17"
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
        <span className="text-slate-500">Clique diretamente na peça do veículo.</span>
      </div>

      {fallbackLocations.length > 0 && (
        <div className="mt-5 rounded-xl border bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800">Outras áreas</h3>
          <p className="mt-1 text-xs text-slate-500">
            Use estes atalhos para áreas internas ou pontos sem hotspot dedicado na imagem.
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
