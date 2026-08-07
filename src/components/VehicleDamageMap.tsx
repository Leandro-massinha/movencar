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
  d: string;
  marker: [number, number];
};

const hotspots: Hotspot[] = [
  {
    location: "FRONT_BUMPER",
    d: "M84 187 C76 205 76 227 84 245 C106 257 132 262 162 263 L174 246 C148 244 123 239 102 228 C95 217 95 204 102 193 C123 182 148 177 174 175 L162 158 C132 159 106 164 84 176 Z",
    marker: [105, 211],
  },
  {
    location: "HOOD",
    d: "M176 176 C218 156 276 149 334 149 L373 168 L373 254 L334 273 C276 273 218 266 176 246 C165 224 165 198 176 176 Z",
    marker: [278, 211],
  },
  {
    location: "WINDSHIELD",
    d: "M373 168 L415 148 L451 151 L451 271 L415 274 L373 254 Z",
    marker: [416, 211],
  },
  {
    location: "ROOF",
    d: "M451 151 C491 145 545 145 585 151 L610 176 L610 246 L585 271 C545 277 491 277 451 271 Z",
    marker: [530, 211],
  },
  {
    location: "REAR_GLASS",
    d: "M610 176 L643 158 L674 162 L674 260 L643 264 L610 246 Z",
    marker: [643, 211],
  },
  {
    location: "TRUNK_LID",
    d: "M674 162 C713 168 753 180 782 195 L797 207 L797 215 L782 227 C753 242 713 254 674 260 Z",
    marker: [740, 211],
  },
  {
    location: "REAR_BUMPER",
    d: "M797 207 C814 201 830 200 842 205 C850 209 854 213 854 211 C854 209 850 213 842 217 C830 222 814 221 797 215 Z",
    marker: [826, 211],
  },
  {
    location: "FRONT_LEFT_FENDER",
    d: "M165 133 C215 105 275 95 337 95 L356 129 L334 149 C276 149 218 156 176 176 L142 158 C148 149 155 141 165 133 Z",
    marker: [245, 125],
  },
  {
    location: "FRONT_RIGHT_FENDER",
    d: "M165 289 C215 317 275 327 337 327 L356 293 L334 273 C276 273 218 266 176 246 L142 264 C148 273 155 281 165 289 Z",
    marker: [245, 297],
  },
  {
    location: "FRONT_LEFT_DOOR",
    d: "M356 95 L454 95 L451 151 L415 148 L373 168 L356 129 Z",
    marker: [405, 120],
  },
  {
    location: "FRONT_RIGHT_DOOR",
    d: "M356 327 L454 327 L451 271 L415 274 L373 254 L356 293 Z",
    marker: [405, 302],
  },
  {
    location: "REAR_LEFT_DOOR",
    d: "M454 95 L585 99 L585 151 C545 145 491 145 451 151 Z",
    marker: [520, 118],
  },
  {
    location: "REAR_RIGHT_DOOR",
    d: "M454 327 L585 323 L585 271 C545 277 491 277 451 271 Z",
    marker: [520, 304],
  },
  {
    location: "REAR_LEFT_QUARTER",
    d: "M585 99 C636 99 691 108 738 124 C760 132 778 143 790 158 L782 195 C753 180 713 168 674 162 L643 158 L610 176 L585 151 Z",
    marker: [682, 128],
  },
  {
    location: "REAR_RIGHT_QUARTER",
    d: "M585 323 C636 323 691 314 738 298 C760 290 778 279 790 264 L782 227 C753 242 713 254 674 260 L643 264 L610 246 L585 271 Z",
    marker: [682, 294],
  },
  {
    location: "LEFT_MIRROR",
    d: "M382 138 C371 122 370 109 379 103 C392 99 405 111 402 132 Z",
    marker: [387, 117],
  },
  {
    location: "RIGHT_MIRROR",
    d: "M382 284 C371 300 370 313 379 319 C392 323 405 311 402 290 Z",
    marker: [387, 305],
  },
  {
    location: "FRONT_LEFT_WHEEL",
    d: "M192 111 C214 101 242 100 263 109 L259 139 C238 132 215 133 196 142 Z",
    marker: [228, 121],
  },
  {
    location: "FRONT_RIGHT_WHEEL",
    d: "M192 311 C214 321 242 322 263 313 L259 283 C238 290 215 289 196 280 Z",
    marker: [228, 301],
  },
  {
    location: "REAR_LEFT_WHEEL",
    d: "M678 119 C700 111 726 113 747 123 L744 153 C724 146 701 146 682 153 Z",
    marker: [712, 132],
  },
  {
    location: "REAR_RIGHT_WHEEL",
    d: "M678 303 C700 311 726 309 747 299 L744 269 C724 276 701 276 682 269 Z",
    marker: [712, 290],
  },
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
        <div className="mx-auto max-w-6xl">
          <svg
            viewBox="0 0 920 422"
            role="img"
            aria-label="Vista superior interativa do veículo para registrar avarias"
            className="h-auto w-full"
          >
            <defs>
              <filter id="vehicleShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.1" />
              </filter>
              <linearGradient id="glassGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>

            <g filter="url(#vehicleShadow)">
              <path
                d="M69 166 C89 129 135 102 194 86 C264 66 351 61 443 61 L570 65 C650 67 726 80 790 105 C835 123 862 151 875 185 C884 207 884 215 875 237 C862 271 835 299 790 317 C726 342 650 355 570 357 L443 361 C351 361 264 356 194 336 C135 320 89 293 69 256 C55 233 49 220 49 211 C49 202 55 189 69 166 Z"
                fill="#ffffff"
                stroke="#64748b"
                strokeWidth="3"
              />

              <path
                d="M174 175 C218 151 276 142 336 142 L374 164 L374 258 L336 280 C276 280 218 271 174 247 C161 224 161 198 174 175 Z"
                fill="#f8fafc"
                stroke="#94a3b8"
                strokeWidth="2"
              />
              <path
                d="M374 164 L414 143 L452 147 L452 275 L414 279 L374 258 Z"
                fill="url(#glassGradient)"
                stroke="#94a3b8"
                strokeWidth="2"
              />
              <path
                d="M452 147 C491 141 546 141 586 147 L611 174 L611 248 L586 275 C546 281 491 281 452 275 Z"
                fill="#f8fafc"
                stroke="#94a3b8"
                strokeWidth="2"
              />
              <path
                d="M611 174 L643 155 L674 160 L674 262 L643 267 L611 248 Z"
                fill="url(#glassGradient)"
                stroke="#94a3b8"
                strokeWidth="2"
              />
              <path
                d="M674 160 C716 167 756 179 785 194 L801 207 L801 215 L785 228 C756 243 716 255 674 262 Z"
                fill="#f8fafc"
                stroke="#94a3b8"
                strokeWidth="2"
              />

              <path d="M139 155 C145 142 155 132 169 122 C217 96 278 88 338 88" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M139 267 C145 280 155 290 169 300 C217 326 278 334 338 334" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M454 95 L454 327" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M585 99 L585 323" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M405 147 C415 172 419 192 419 211 C419 230 415 250 405 275" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M643 155 C635 176 631 195 631 211 C631 227 635 246 643 267" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              <path d="M502 158 C527 151 554 151 578 157" fill="none" stroke="#e2e8f0" strokeWidth="2" />
              <path d="M502 264 C527 271 554 271 578 265" fill="none" stroke="#e2e8f0" strokeWidth="2" />

              <g aria-hidden="true">
                <ellipse cx="228" cy="121" rx="31" ry="13" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
                <ellipse cx="228" cy="301" rx="31" ry="13" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
                <ellipse cx="712" cy="132" rx="31" ry="13" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
                <ellipse cx="712" cy="290" rx="31" ry="13" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
                <circle cx="228" cy="121" r="7" fill="#ffffff" stroke="#64748b" strokeWidth="2" />
                <circle cx="228" cy="301" r="7" fill="#ffffff" stroke="#64748b" strokeWidth="2" />
                <circle cx="712" cy="132" r="7" fill="#ffffff" stroke="#64748b" strokeWidth="2" />
                <circle cx="712" cy="290" r="7" fill="#ffffff" stroke="#64748b" strokeWidth="2" />
              </g>

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
                    <path
                      d={hotspot.d}
                      fill={count ? "rgba(250, 204, 21, 0.30)" : "rgba(255,255,255,0.001)"}
                      stroke={count ? "#eab308" : "rgba(148,163,184,0.28)"}
                      strokeWidth={count ? 3 : 1.4}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={hotspot.d}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth="10"
                      vectorEffect="non-scaling-stroke"
                    />
                    {count > 0 && (
                      <g aria-hidden="true">
                        <circle
                          cx={hotspot.marker[0]}
                          cy={hotspot.marker[1]}
                          r="13"
                          fill="#facc15"
                          stroke="#ffffff"
                          strokeWidth="3"
                        />
                        <text
                          x={hotspot.marker[0]}
                          y={hotspot.marker[1] + 4}
                          textAnchor="middle"
                          className="fill-black text-[12px] font-bold"
                        >
                          {count > 9 ? "9+" : count}
                        </text>
                      </g>
                    )}
                    <title>{label}</title>
                  </g>
                );
              })}
            </g>

            <g aria-hidden="true" className="fill-slate-400">
              <path d="M78 384 L78 396 L102 390 Z" />
              <text x="108" y="395" className="text-[13px] font-semibold">DIANTEIRA</text>
              <text x="744" y="395" className="text-[13px] font-semibold">TRASEIRA</text>
            </g>
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full border border-slate-400 bg-white" /> Sem avaria
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-yellow-600" /> Área com avaria
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
                  <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
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
