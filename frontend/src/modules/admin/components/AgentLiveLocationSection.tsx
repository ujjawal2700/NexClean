import { useState, useEffect } from "react";
import {
  Radio,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  WifiOff,
  Compass,
  Gauge,
  Clock,
  Maximize2,
  AlertTriangle,
} from "lucide-react";
import { GlassCard } from "@shared/ui/GlassCard";
import { Button } from "@shared/ui/Button";
import { LiveTrackingMap } from "@shared/components/map/LiveTrackingMap";
import { useAgentLocation } from "../api/admin.api";
import { cn } from "@shared/lib/utils";

const FIX_STALE_SECONDS = 45;

function getHeadingDirection(degrees: number | null | undefined): string {
  if (degrees == null || !Number.isFinite(degrees)) return "Stationary";
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalized / 45) % 8;
  return `${Math.round(normalized)}° (${directions[index]})`;
}

interface AgentLiveLocationSectionProps {
  agentId: string;
  agentName: string;
  city?: string;
  area?: string;
  onOpenModal?: () => void;
}

export function AgentLiveLocationSection({
  agentId,
  agentName,
  city,
  area,
  onOpenModal,
}: AgentLiveLocationSectionProps) {
  const { data, isLoading, isFetching, refetch, error } = useAgentLocation(agentId, true);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  // Live timer tick for seconds ago counter
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fix = data?.agentLocation ?? null;
  const agentPos = fix ? { lat: fix.lat, lng: fix.lng } : null;
  const isOnline = Boolean(data?.online);
  const staleSeconds = fix ? Math.max(0, Math.round((now - new Date(fix.updatedAt).getTime()) / 1000)) : null;
  const isStale = staleSeconds != null && staleSeconds > FIX_STALE_SECONDS;

  const handleCopyCoords = () => {
    if (!agentPos) return;
    const coordsStr = `${agentPos.lat.toFixed(6)}, ${agentPos.lng.toFixed(6)}`;
    navigator.clipboard.writeText(coordsStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const googleMapsUrl = agentPos
    ? `https://www.google.com/maps?q=${agentPos.lat},${agentPos.lng}`
    : undefined;

  return (
    <GlassCard className="overflow-hidden border border-line/80 p-0 shadow-sm transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 bg-surface/50 px-5 py-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Radio className="size-5" />
            {isOnline && (
              <span className="absolute -top-0.5 -right-0.5 flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-ink">Real-time Live Location</h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium",
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-ink/5 text-muted border border-line",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted",
                  )}
                />
                {isOnline ? "App Online" : "App Offline"}
              </span>
            </div>
            <p className="text-xs text-muted">
              Live GPS stream from {agentName}'s mobile / web app
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {agentPos && (
            <>
              <button
                type="button"
                onClick={handleCopyCoords}
                title="Copy coordinates"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : `${agentPos.lat.toFixed(4)}, ${agentPos.lng.toFixed(4)}`}
              </button>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in Google Maps"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <ExternalLink className="size-3.5" />
                Google Maps
              </a>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 px-2.5"
            title="Refresh location"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin text-primary")} />
          </Button>

          {onOpenModal && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenModal}
              className="h-8 px-2.5"
              title="Expand full screen"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative bg-surface-muted/30">
        {isLoading && !data ? (
          <div className="flex h-80 flex-col items-center justify-center gap-2 text-muted">
            <RefreshCw className="size-6 animate-spin text-primary" />
            <p className="text-sm">Connecting to agent GPS feed...</p>
          </div>
        ) : error && !data ? (
          <div className="flex h-80 flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="size-8 text-amber-500" />
            <p className="mt-2 font-medium text-ink">Unable to load live location</p>
            <p className="mt-1 text-xs text-muted">
              {error instanceof Error ? error.message : "Please check your network connection"}
            </p>
          </div>
        ) : (
          <>
            <LiveTrackingMap
              destination={null}
              agent={agentPos}
              heading={fix?.heading ?? null}
              showRoute={false}
              badge={
                agentPos
                  ? {
                      title: isStale ? "Last seen" : isOnline ? "Live Now" : "Last Position",
                      subtitle: staleSeconds != null ? `${staleSeconds}s ago` : "Recent",
                    }
                  : null
              }
              className="h-80 w-full md:h-96"
            />

            {!agentPos && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/85 p-6 text-center backdrop-blur-xs">
                <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <WifiOff className="size-6" />
                </div>
                <h3 className="mt-3 font-display text-base font-semibold text-ink">
                  No Active GPS Signal
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted">
                  {agentName} has not broadcasted GPS data recently. Position updates automatically stream here whenever the agent opens the NexClean app and enables location services.
                </p>
                {(city || area) && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-soft">
                    <MapPin className="size-3 text-primary" />
                    Base Region: {[area, city].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Telemetry & Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 border-t border-line/80 bg-surface/80 p-4 sm:grid-cols-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Coordinates</p>
            <p className="truncate text-xs font-semibold text-ink">
              {agentPos ? `${agentPos.lat.toFixed(5)}, ${agentPos.lng.toFixed(5)}` : "Unavailable"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
            <Compass className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Bearing / Heading</p>
            <p className="truncate text-xs font-semibold text-ink">
              {getHeadingDirection(fix?.heading)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600">
            <Gauge className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Speed</p>
            <p className="truncate text-xs font-semibold text-ink">
              {fix?.speed != null && fix.speed > 0
                ? `${Math.round(fix.speed * 3.6)} km/h`
                : agentPos
                  ? "Stationary / Idle"
                  : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600">
            <Clock className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Last Fix</p>
            <p className="truncate text-xs font-semibold text-ink">
              {staleSeconds != null
                ? `${staleSeconds}s ago`
                : isOnline
                  ? "Awaiting fix"
                  : "Offline"}
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
