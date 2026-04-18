import type { SupabaseClient } from "@supabase/supabase-js";

type VerifyFaceIdentityParams = {
  supabase: SupabaseClient;
  provider: string;
  samples: number[][];
  capturedAt: string;
};

export type BackendFaceIdentity = {
  faceId: string;
  faceVector: {
    version: string;
    sample_count: number;
    dimensions: number;
    averages: number[];
  };
  reference: string;
};

function isBackendFaceIdentity(value: unknown): value is BackendFaceIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BackendFaceIdentity>;

  return (
    typeof candidate.faceId === "string" &&
    typeof candidate.reference === "string" &&
    Boolean(candidate.faceVector) &&
    Array.isArray(candidate.faceVector?.averages) &&
    typeof candidate.faceVector?.dimensions === "number" &&
    typeof candidate.faceVector?.sample_count === "number" &&
    typeof candidate.faceVector?.version === "string"
  );
}

export async function createBackendFaceIdentity({
  supabase,
  provider,
  samples,
  capturedAt,
}: VerifyFaceIdentityParams): Promise<BackendFaceIdentity> {
  if (samples.length === 0) {
    throw new Error("We could not build a face vector yet. Please retry the camera check.");
  }

  const { data, error } = await supabase.functions.invoke("verify-face-identity", {
    body: {
      captured_at: capturedAt,
      provider,
      samples,
    },
  });

  if (error) {
    const message = error.message || "";

    if (message.includes("Failed to send a request") || message.includes("FunctionsHttpError")) {
      throw new Error(
        'The backend face verification service is not reachable. Deploy the Supabase Edge Function "verify-face-identity" and try again.',
      );
    }

    throw error;
  }

  if (!isBackendFaceIdentity(data)) {
    throw new Error("The backend face verification service returned an invalid response.");
  }

  return data;
}
