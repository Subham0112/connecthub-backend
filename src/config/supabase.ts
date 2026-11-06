import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const SUPABASE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET?.trim() || "PostMedia";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && serviceRoleKey);

let client: SupabaseClient | null = null;


export const getSupabase = (): SupabaseClient => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

/**
 * Make sure the storage bucket exists and is publicly readable so frontend
 * <img>/<video> tags can load uploaded media without signed URLs.
 * Safe to call on every boot; it only creates the bucket when missing.
 */
export const ensureStorageBucket = async (): Promise<void> => {
  if (!isSupabaseConfigured) {
    console.warn(
      "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — file uploads will fail until configured."
    );
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.storage.getBucket(SUPABASE_BUCKET);

  if (data) return;

  if (error && !/not found/i.test(error.message)) {
    console.error(`[supabase] Could not read bucket "${SUPABASE_BUCKET}":`, error.message);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(
    SUPABASE_BUCKET,
    {
      public: true,
      fileSizeLimit: "25MB",
    }
  );

  if (createError && !/already exists/i.test(createError.message)) {
    console.error(
      `[supabase] Could not create bucket "${SUPABASE_BUCKET}":`,
      createError.message
    );
    return;
  }

  console.log(`[supabase] Storage bucket "${SUPABASE_BUCKET}" is ready.`);
};
