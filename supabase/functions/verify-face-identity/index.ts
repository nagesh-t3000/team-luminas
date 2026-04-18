import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
};

type VerifyFaceIdentityRequest = {
  provider?: string;
  captured_at?: string;
  samples?: number[][];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeAverages(samples: number[][]) {
  const dimensions = samples[0]?.length ?? 0;

  if (dimensions === 0) {
    throw new Error("Face samples must contain at least one dimension.");
  }

  for (const sample of samples) {
    if (!Array.isArray(sample) || sample.length !== dimensions) {
      throw new Error("All face samples must have the same dimension length.");
    }

    for (const value of sample) {
      if (!Number.isFinite(value)) {
        throw new Error("Face samples must only contain finite numeric values.");
      }
    }
  }

  return Array.from({ length: dimensions }, (_, index) => {
    const total = samples.reduce((sum, sample) => sum + sample[index], 0);
    return Number((total / samples.length).toFixed(6));
  });
}

async function hashFaceVector(averages: number[]) {
  const payload = averages.map((value) => value.toFixed(6)).join("|");
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const body = (await request.json()) as VerifyFaceIdentityRequest;
    const samples = body.samples ?? [];

    if (!Array.isArray(samples) || samples.length < 4) {
      return json(
        { error: "At least four face samples are required to build a backend face identity." },
        400,
      );
    }

    const averages = normalizeAverages(samples);
    const faceId = await hashFaceVector(averages);

    return json({
      faceId,
      faceVector: {
        averages,
        dimensions: averages.length,
        sample_count: samples.length,
        version: "supabase-edge-face-vector-v1",
      },
      provider: body.provider ?? "supabase-edge-face-id",
      reference: `edge-${body.captured_at ?? new Date().toISOString()}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build backend face identity.";
    return json({ error: message }, 400);
  }
});
