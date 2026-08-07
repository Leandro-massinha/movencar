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
  d: string;
  marker: [number, number];
};

const regions: Region[] = [
  {
    location: "FRONT_BUMPER",
    d: "M64 146 C46 154 38 168 38 180 C38 192 46 206 64 214 L82 208 C76 190 76 170 82 152 Z",
    marker: [56, 180],
  },
  {
    location: "HOOD",
    d: "M82 152 C110 132 150 122 205 118 L244 118 L258 148 L258 212 L244 242 L205 242 C150 238 110 228 82 208 C76 190 76 170 82 152 Z",
    marker: [166, 180],
  },
  {
    location: "WINDSHIELD",
    d: "M258 148 L292 126 L322 124 L322 236 L292 234 L258 212 Z",
    marker: [292, 180],
  },
  {
    location: "ROOF",
    d: "M322 124 C355 118 405 116 444 122 L464 143 L464 217 L444 238 C405 244 355 242 322 236 Z",
    marker: [392, 180],
  },
  {
    location: "REAR_GLASS",
    d: "M464 143 L493 126 L521 128 L521 232 L493 234 L464 217 Z",
    marker: [492, 180],
  },
  {
    location: "TRUNK_LID",
    d: "M521 128 C568 130 618 140 650 154 L664 168 L664 192 L650 206 C618 220 568 230 521 232 Z",
    marker: [588, 180],
  },
  {
    location: "REAR_BUMPER",
    d: "M664 168 L690 158 C710 164 722 172 722 180 C722 188 710 196 690 202 L664 192 Z",
    marker: [698, 180],
  },
  {
    location: "FRONT_LEFT_FENDER",
    d: "M92 121 C130 100 177 88 225 88 L244 118 L205 118 C150 122 110 132 82 152 L68 143 C72 136 80 128 92 121 Z",
    marker: [164, 110],
  },
  {
    location: "FRONT_RIGHT_FENDER",
    d: "M92 239 C130 260 177 272 225 272 L244 242 L205 242 C150 238 110 228 82 208 L68 217 C72 224 80 232 92 239 Z",
    marker: [164, 250],
  },
  {
    location: "FRONT_LEFT_DOOR",
    d: "M244 88 L330 88 L322 124 L292 126 L258 148 L244 118 Z",
    marker: [286, 105],
  },
  {
    location: "FRONT_RIGHT_DOOR",
    d: "M244 272 L330 272 L322 236 L292 234 L258 212 L244 242 Z",
    marker: [286, 255],
  },
  {
    location: "REAR_LEFT_DOOR",
    d: "M330 88 L444 92 L444 122 C405 116 355 118 322 124 Z",
    marker: [386, 104],
  },
  {
    location: "REAR_RIGHT_DOOR",
    d: "M330 272 L444 268 L444 238 C405 244 355 242 322 236 Z",
    marker: [386, 256],
  },
  {
    location: "REAR_LEFT_QUARTER",
    d: "M444 92 C495 92 552 100 603 116 C628 124 645 135 656 149 L650 154 C618 140 568 130 521 128 L493 126 L464 143 L444 122 Z",
    marker: [538, 112],
  },
  {
    location: "REAR_RIGHT_QUARTER",
    d: "M444 268 C495 268 552 260 603 244 C628 236 645 225 656 211 L650 206 C618 220 568 230 521 232 L493 234 L464 217 L444 238 Z",
    marker: [538, 248],
  },
  {
    location: "LEFT_MIRROR",
    d: "M270 120 C260 109 260 98 269 94 C280 91 290 101 288 117 Z",
    marker: [274, 104],
  },
  {
    location: "RIGHT_MIRROR",
    d: "M270 240 C260 251 260 262 269 266 C280 269 290 259 288 243 Z",
    marker: [274, 256],
  },
  {
    location: "FRONT_LEFT_WHEEL",
    d: "M118 78 C138 70 162 70 179 79 L176 104 C159 98 139 100 123 107 Z",
    marker: [149, 88],
  },
  {
    location: "FRONT_RIGHT_WHEEL",
    d: "M118 282 C138 290 162 290 179 281 L176 256 C159 262 139 260 123 253 Z",
    marker: [149, 272],
  },
  {
    location: "REAR_LEFT_WHEEL",
    d: "M548 92 C568 84 592 86 610 96 L606 120 C589 114 569 114 552 120 Z",
    marker: [579, 102],
  },
  {
    location: "REAR_RIGHT_WHEEL",
    d: "M548 268 C568 276 592 274 610 264 L606 240 C589 246 569 246 552 240 Z",
    marker: [579, 258],
  },
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
    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="overflow-hidden rounded-xl border bg-slate-50 p-3 sm:p-5">
        <div className="mx-auto max-w-5xl">
          <svg
            viewBox="0 0 760 360"
            role="img"
            aria-label="Vista superior interativa do veículo para registrar avarias"
            className="h-auto w-full"
          >
            <defs>
              <filter id="vehicleShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity="0.12" />
              </filter>
            </defs>

            <g filter="url(#vehicleShadow)">
              <path
                d="M61 143 C79 115 116 96 168 83 C224 69 289 66 357 66 L458 70 C529 72 594 82 646 101 C684 115 707 137 718 163 C724 177 724 183 718 197 C707 223 684 245 646 259 C594 278 529 288 458 290 L357 294 C289 294 224 291 168 277 C116 264 79 245 61 217 C49 199 43 191 43 180 C43 169 49 161 61 143 Z"
                className="fill-white stroke-slate-400"
                strokeWidth="2.5"
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
                    <path
                      d={region.d}
                      className={
                        count
                          ? "fill-amber-100 stroke-amber-500 transition hover:fill-amber-200 focus:fill-amber-200"
                          : "fill-white stroke-slate-400 transition hover:fill-brand-50 focus:fill-brand-50"
                      }
                      strokeWidth={count ? 2.4 : 1.6}
                      vectorEffect="non-scaling-stroke"
                    />
                    {count > 0 && (
                      <g aria-hidden="true">
                        <circle
                          cx={region.marker[0]}
                          cy={region.marker[1]}
                          r="11"
                          className="fill-amber-500 stroke-white"
                          strokeWidth="2"
                        />
                        <text
                          x={region.marker[0]}
                          y={region.marker[1] + 4}
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

              <g aria-hidden="true" className="pointer-events-none fill-none stroke-slate-300">
                <path d="M205 118 C221 102 237 90 257 82" />
                <path d="M205 242 C221 258 237 270 257 278" />
                <path d="M292 126 C302 145 306 161 306 180 C306 199 302 215 292 234" />
                <path d="M493 126 C485 145 482 161 482 180 C482 199 485 215 493 234" />
                <path d="M82 152 C67 158 57 168 55 180 C57 192 67 202 82 208" />
                <path d="M650 154 C671 160 684 169 688 180 C684 191 671 200 650 206" />
                <path d="M351 132 C377 126 410 126 435 132" />
                <path d="M351 228 C377 234 410 234 435 228" />
              </g>

              <g aria-hidden="true" className="pointer-events-none">
                <ellipse cx="143" cy="93" rx="24" ry="10" className="fill-slate-100 stroke-slate-400" />
                <ellipse cx="143" cy="267" rx="24" ry="10" className="fill-slate-100 stroke-slate-400" />
                <ellipse cx="578" cy="107" rx="24" ry="10" className="fill-slate-100 stroke-slate-400" />
                <ellipse cx="578" cy="253" rx="24" ry="10" className="fill-slate-100 stroke-slate-400" />
                <circle cx="143" cy="93" r="5" className="fill-white stroke-slate-400" />
                <circle cx="143" cy="267" r="5" className="fill-white stroke-slate-400" />
                <circle cx="578" cy="107" r="5" className="fill-white stroke-slate-400" />
                <circle cx="578" cy="253" r="5" className="fill-white stroke-slate-400" />
              </g>
            </g>

            <text x="42" y="338" className="fill-slate-400 text-[12px] font-semibold">
              DIANTEIRA
            </text>
            <path d="M42 320 L42 330 L64 325 Z" className="fill-slate-400" aria-hidden="true" />
            <text x="664" y="338" className="fill-slate-400 text-[12px] font-semibold">
              TRASEIRA
            </text>
          </svg>
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
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800">Outras áreas</h3>
        <p className="mt-1 text-xs text-slate-500">
          Use esta lista para áreas internas ou que não aparecem na vista superior.
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
