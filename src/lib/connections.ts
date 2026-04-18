import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const STORAGE_KEY = "luminas-connections";
const CONNECTIONS_CHANGED_EVENT = "luminas:connections-changed";

type ConnectionStore = Record<string, string[]>;

const seededConnectionCounts: Record<string, number> = {
  alexrivera: 318,
  nvcapital: 426,
  "priya.codes": 189,
  talentgrid_io: 274,
  marcuszhou: 143,
  elenavc: 231,
  hireloop: 198,
  "jordan.lee": 121,
  sage_advisory: 165,
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unable to sync connections right now.";
}

function isMissingConnectionsRpcError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("Could not find the function public.list_connected_usernames") ||
    message.includes("Could not find the function public.get_connection_count") ||
    message.includes("Could not find the function public.toggle_user_connection") ||
    message.includes("schema cache")
  );
}

function normalizeUsername(username: string) {
  return username.trim();
}

function normalizeTargets(sourceUsername: string, targets: unknown) {
  const normalizedSource = normalizeUsername(sourceUsername);

  if (!Array.isArray(targets)) {
    return [];
  }

  return Array.from(
    new Set(
      targets
        .map((target) => (typeof target === "string" ? normalizeUsername(target) : ""))
        .filter((target) => target.length > 0 && target !== normalizedSource),
    ),
  );
}

function readConnectionStore(): ConnectionStore {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([sourceUsername, targets]) => {
        const normalizedSource = normalizeUsername(sourceUsername);

        if (!normalizedSource) {
          return [];
        }

        return [[normalizedSource, normalizeTargets(normalizedSource, targets)]];
      }),
    );
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

function writeConnectionStore(store: ConnectionStore) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CONNECTIONS_CHANGED_EVENT));
}

function getLocalConnectedUsernames(sourceUsername: string) {
  const normalizedSource = normalizeUsername(sourceUsername);

  if (!normalizedSource) {
    return [];
  }

  return readConnectionStore()[normalizedSource] ?? [];
}

function syncLocalConnection(sourceUsername: string, targetUsername: string, isConnected: boolean) {
  const normalizedSource = normalizeUsername(sourceUsername);
  const normalizedTarget = normalizeUsername(targetUsername);

  if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
    return;
  }

  const store = readConnectionStore();
  const nextTargets = isConnected
    ? Array.from(new Set([...getLocalConnectedUsernames(normalizedSource), normalizedTarget]))
    : getLocalConnectedUsernames(normalizedSource).filter((username) => username !== normalizedTarget);

  if (nextTargets.length === 0) {
    delete store[normalizedSource];
  } else {
    store[normalizedSource] = nextTargets;
  }

  writeConnectionStore(store);
}

function toggleLocalConnection(sourceUsername: string, targetUsername: string) {
  const normalizedSource = normalizeUsername(sourceUsername);
  const normalizedTarget = normalizeUsername(targetUsername);

  if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
    return false;
  }

  const isConnected = getLocalConnectedUsernames(normalizedSource).includes(normalizedTarget);
  syncLocalConnection(normalizedSource, normalizedTarget, !isConnected);
  return !isConnected;
}

function getLocalConnectionCount(username: string) {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return 0;
  }

  const store = readConnectionStore();
  const connectedUsernames = new Set(getLocalConnectedUsernames(normalizedUsername));

  for (const [sourceUsername, targets] of Object.entries(store)) {
    if (sourceUsername !== normalizedUsername && targets.includes(normalizedUsername)) {
      connectedUsernames.add(sourceUsername);
    }
  }

  return (seededConnectionCounts[normalizedUsername] ?? 0) + connectedUsernames.size;
}

function normalizeConnectedUsernames(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) =>
      typeof item === "object" && item !== null && "username" in item && typeof item.username === "string"
        ? normalizeUsername(item.username)
        : "",
    )
    .filter(Boolean);
}

function normalizeConnectionCount(data: unknown) {
  const record = Array.isArray(data) ? data[0] : data;

  if (
    typeof record === "object" &&
    record !== null &&
    "connection_count" in record &&
    (typeof record.connection_count === "number" || typeof record.connection_count === "string")
  ) {
    const count = Number(record.connection_count);
    return Number.isFinite(count) ? count : 0;
  }

  return 0;
}

function normalizeToggleResult(data: unknown) {
  const record = Array.isArray(data) ? data[0] : data;

  if (typeof record === "object" && record !== null && "is_connected" in record) {
    return Boolean(record.is_connected);
  }

  return false;
}

export function subscribeToConnections(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleConnectionsChanged = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(CONNECTIONS_CHANGED_EVENT, handleConnectionsChanged);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CONNECTIONS_CHANGED_EVENT, handleConnectionsChanged);
    window.removeEventListener("storage", handleStorage);
  };
}

export async function listConnectedUsernames(sourceUsername: string) {
  const normalizedSource = normalizeUsername(sourceUsername);

  if (!normalizedSource) {
    return [];
  }

  if (!supabase || !isSupabaseConfigured) {
    return getLocalConnectedUsernames(normalizedSource);
  }

  try {
    const { data, error } = await supabase.rpc("list_connected_usernames", {
      username_input: normalizedSource,
    });

    if (error) {
      if (isMissingConnectionsRpcError(error)) {
        return getLocalConnectedUsernames(normalizedSource);
      }

      throw new Error(getErrorMessage(error));
    }

    return normalizeConnectedUsernames(data);
  } catch (error) {
    console.error("Failed to load connected usernames", error);
    return getLocalConnectedUsernames(normalizedSource);
  }
}

export async function getConnectionCount(username: string) {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return 0;
  }

  if (!supabase || !isSupabaseConfigured) {
    return getLocalConnectionCount(normalizedUsername);
  }

  try {
    const { data, error } = await supabase.rpc("get_connection_count", {
      username_input: normalizedUsername,
    });

    if (error) {
      if (isMissingConnectionsRpcError(error)) {
        return getLocalConnectionCount(normalizedUsername);
      }

      throw new Error(getErrorMessage(error));
    }

    return normalizeConnectionCount(data);
  } catch (error) {
    console.error("Failed to load connection count", error);
    return getLocalConnectionCount(normalizedUsername);
  }
}

export async function toggleConnection(sourceUsername: string, targetUsername: string) {
  const normalizedSource = normalizeUsername(sourceUsername);
  const normalizedTarget = normalizeUsername(targetUsername);

  if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
    return false;
  }

  if (!supabase || !isSupabaseConfigured) {
    return toggleLocalConnection(normalizedSource, normalizedTarget);
  }

  try {
    const { data, error } = await supabase.rpc("toggle_user_connection", {
      source_username_input: normalizedSource,
      target_username_input: normalizedTarget,
    });

    if (error) {
      if (isMissingConnectionsRpcError(error)) {
        return toggleLocalConnection(normalizedSource, normalizedTarget);
      }

      throw new Error(getErrorMessage(error));
    }

    const isConnected = normalizeToggleResult(data);
    syncLocalConnection(normalizedSource, normalizedTarget, isConnected);
    return isConnected;
  } catch (error) {
    console.error("Failed to toggle connection", error);
    return toggleLocalConnection(normalizedSource, normalizedTarget);
  }
}
