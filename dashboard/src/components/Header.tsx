import type { StatusResponse } from '../types/api';

interface HeaderProps {
    tenantId: string;
    onTenantIdChange: (next: string) => void;
    status: StatusResponse | null;
    lastUpdated: number | null;
    apiUrl: string;
}

function formatLastUpdated(ts: number | null): string {
    if (!ts) return 'never';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 2) return 'live';
    return `${diff}s ago`;
}

export function Header({ tenantId, onTenantIdChange, status, lastUpdated, apiUrl }: HeaderProps) {
    const totalViolations = status?.violations.total ?? 0;
    const bySeverity = status?.violations.bySeverity ?? {};
    const byFramework = status?.violations.byFramework ?? {};

    return (
        <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-3">
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold tracking-tight text-neutral-100">
                    Comply<span className="text-emerald-400">Flow</span>
                </h1>
                <span className="hidden text-[11px] text-neutral-500 sm:inline">
                    Live compliance topology
                </span>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <label className="text-[11px] uppercase tracking-wider text-neutral-500">Tenant</label>
                    <input
                        type="text"
                        value={tenantId}
                        onChange={(e) => onTenantIdChange(e.target.value)}
                        className="w-48 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-200 outline-none focus:border-emerald-500"
                        placeholder="homeai-sandbox"
                    />
                </div>

                <div className="flex items-center gap-3 text-xs">
                    <Stat label="Active" value={status?.active ? 'yes' : 'no'} tone={status?.active ? 'good' : 'muted'} />
                    <Stat label="Violations" value={String(totalViolations)} tone={totalViolations > 0 ? 'bad' : 'good'} />
                    <Stat label="Critical" value={String(bySeverity.critical ?? 0)} tone={(bySeverity.critical ?? 0) > 0 ? 'bad' : 'muted'} />
                    <Stat label="Frameworks" value={String(Object.keys(byFramework).length)} tone="muted" />
                </div>

                <div className="hidden flex-col items-end text-right md:flex">
                    <span className="font-mono text-[10px] text-neutral-600">{apiUrl}</span>
                    <span className="text-[10px] text-neutral-500">updated {formatLastUpdated(lastUpdated)}</span>
                </div>
            </div>
        </header>
    );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'muted' }) {
    const color =
        tone === 'good' ? 'text-emerald-300'
        : tone === 'bad' ? 'text-red-300'
        : 'text-neutral-400';
    return (
        <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
            <span className={`font-mono text-sm ${color}`}>{value}</span>
        </div>
    );
}
