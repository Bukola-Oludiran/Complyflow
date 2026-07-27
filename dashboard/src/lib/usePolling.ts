import { useEffect, useRef, useState } from 'react';

interface PollingState<T> {
    data: T | null;
    error: Error | null;
    loading: boolean;
    lastUpdated: number | null;
}

/**
 * Polls `fetcher` every `intervalMs`. Returns the latest data, last error,
 * loading flag (true only on the FIRST request — subsequent polls don't flip
 * it), and a Date timestamp of last successful fetch.
 *
 * `enabled = false` pauses polling without unmounting.
 */
export function usePolling<T>(
    fetcher: () => Promise<T>,
    intervalMs: number,
    enabled: boolean = true,
): PollingState<T> {
    const [state, setState] = useState<PollingState<T>>({
        data: null,
        error: null,
        loading: true,
        lastUpdated: null,
    });
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        const tick = async () => {
            try {
                const data = await fetcherRef.current();
                if (!cancelled) {
                    setState({
                        data,
                        error: null,
                        loading: false,
                        lastUpdated: Date.now(),
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setState(prev => ({
                        ...prev,
                        error: err as Error,
                        loading: false,
                    }));
                }
            }
        };

        tick();
        const id = window.setInterval(tick, intervalMs);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [intervalMs, enabled]);

    return state;
}
