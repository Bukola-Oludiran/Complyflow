import type { ComplianceViolation } from '../types/api';

interface ViolationsPanelProps {
    violations: ComplianceViolation[];
    total: number;
}

const SEVERITY_COLORS: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300 border-red-500/40',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
};

function formatTimestamp(ts: number): string {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
}

export function ViolationsPanel({ violations, total }: ViolationsPanelProps) {
    return (
        <div className="flex h-full flex-col border-l border-neutral-800 bg-neutral-950/60">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <h2 className="text-sm font-semibold tracking-wide text-neutral-200">VIOLATIONS</h2>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">{total}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
                {violations.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-500">
                        No violations detected. Policy engine is monitoring.
                    </div>
                ) : (
                    <ul className="divide-y divide-neutral-900">
                        {violations.map((v) => (
                            <li key={v.id} className="px-4 py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <span
                                        className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                                            SEVERITY_COLORS[v.severity] ?? SEVERITY_COLORS.low
                                        }`}
                                    >
                                        {v.severity}
                                    </span>
                                    <span className="text-[10px] text-neutral-500">{formatTimestamp(v.detectedAt)}</span>
                                </div>
                                <p className="mt-2 text-sm text-neutral-200">{v.title}</p>
                                <p className="mt-1 font-mono text-[11px] text-neutral-500">
                                    {v.framework} · {v.ruleId}
                                    {v.service && <> · {v.service}</>}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
