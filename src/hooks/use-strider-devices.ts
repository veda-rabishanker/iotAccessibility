import { useCallback, useEffect, useRef, useState } from 'react';

/** A Strider ESP32 board found on the local Wi-Fi. */
export type StriderDevice = {
  /** What the board does, e.g. "cam". */
  role: string;
  /** Short per-board id from its MAC, e.g. "3fa2". */
  id: string;
  /** mDNS name, e.g. "strider-cam-3fa2.local". */
  name: string;
  /** Address that answered, used for the stream URL. */
  host: string;
  /** Port of the video stream: 81 on current firmware (its own server), 80 on older boards. */
  streamPort: number;
};

export type DiscoveryState = 'searching' | 'done';

/** The Strider-CAM hotspot always puts the camera here. */
const SOFTAP_HOST = '192.168.4.1';
/** An iPhone personal hotspot only hands out 172.20.10.2 – 172.20.10.14. */
const IPHONE_HOTSPOT_HOSTS = Array.from({ length: 13 }, (_, i) => `172.20.10.${i + 2}`);
const PROBE_TIMEOUT_MS = 1500;

/** Last boards that answered, so the next search tries them first. Kept for the app session. */
let remembered: StriderDevice[] = [];

/** Accept "192.168.4.1", "strider-cam-3fa2.local", or a full "http://host:port/stream" URL. */
export function hostFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
  const host = withoutScheme.split('/')[0];
  return host || null;
}

export function streamUrl(device: StriderDevice): string {
  return `http://${device.host}:${device.streamPort}/stream`;
}

async function probe(host: string): Promise<StriderDevice | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`http://${host}/status`, { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    if (data.device === 'strider') {
      return {
        role: String(data.role ?? 'cam'),
        id: String(data.id ?? host),
        name: String(data.name ?? host),
        host,
        streamPort: typeof data.stream_port === 'number' ? data.stream_port : 80,
      };
    }
    // Firmware flashed before device/role were added: /status had ok + mode only.
    if (data.ok === true && typeof data.mode === 'string') {
      return { role: 'cam', id: host, name: host, host, streamPort: 80 };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function unique(devices: StriderDevice[]): StriderDevice[] {
  const seen = new Map<string, StriderDevice>();
  for (const device of devices) {
    // The same board can answer on its IP and its .local name; keep the first.
    if (!seen.has(device.id)) seen.set(device.id, device);
  }
  return [...seen.values()];
}

/** Probe every likely address at once and return the Strider boards that answered. */
export async function findStriderDevices(extraHosts: string[] = []): Promise<StriderDevice[]> {
  const hosts = [
    ...extraHosts,
    ...remembered.flatMap((d) => [d.host, d.name]),
    SOFTAP_HOST,
    ...IPHONE_HOTSPOT_HOSTS,
  ];
  const results = await Promise.all([...new Set(hosts)].map(probe));
  const found = unique(results.filter((d): d is StriderDevice => d !== null));
  if (found.length > 0) remembered = found;
  return found;
}

export function useStriderDevices() {
  const [state, setState] = useState<DiscoveryState>('searching');
  const [devices, setDevices] = useState<StriderDevice[]>([]);
  const run = useRef(0);

  const search = useCallback(async (extraHosts: string[] = []) => {
    const id = ++run.current;
    setState('searching');
    const found = await findStriderDevices(extraHosts);
    if (id !== run.current) return found; // A newer search started.
    setDevices(found);
    setState('done');
    return found;
  }, []);

  useEffect(() => {
    // First search on mount; state already starts as "searching".
    const id = ++run.current;
    findStriderDevices().then((found) => {
      if (id !== run.current) return;
      setDevices(found);
      setState('done');
    });
    return () => {
      run.current += 1;
    };
  }, []);

  return { state, devices, search };
}
