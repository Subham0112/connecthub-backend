import fs from "fs/promises";
import path from "path";
import { getSupabase, SUPABASE_BUCKET } from "../config/supabase.js";
import prisma from "../config/prisma.js";

export type StorageFolder = "posts" | "profiles";

export interface UploadedFile {
  /** Object path inside the bucket, e.g. posts/12/1720000000000-abc-pic.jpg */
  path: string;
  /** Public URL the frontend can render directly */
  url: string;
}

// New storage objects always live under one of these prefixes. Anything else
// is a legacy filename from the old local-disk implementation.
const STORAGE_PATH_PATTERN = /^(posts|profiles)\//;

const clampFilename = (name: string, max = 60): string => {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).slice(0, 10) : "";
  const base = name.slice(0, Math.max(max - ext.length, 1));
  return `${base}${ext}`;
};

const sanitizeFilename = (name: string): string => {
  const cleaned = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  return clampFilename(cleaned || "file");
};

const buildObjectPath = (
  folder: StorageFolder,
  userId: number,
  originalName: string
): string => {
  const safe = sanitizeFilename(originalName);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${folder}/${userId}/${unique}-${safe}`;
};

/**
 * Upload an in-memory multer file to Supabase Storage and return both the
 * object path (persisted in media.filename) and its public URL.
 */
export const uploadFileToStorage = async (
  file: Express.Multer.File,
  folder: StorageFolder,
  userId: number
): Promise<UploadedFile> => {
  const supabase = getSupabase();
  const objectPath = buildObjectPath(folder, userId, file.originalname);

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(objectPath);

  return { path: objectPath, url: data.publicUrl };
};

/**
 * Extract the object path from a Supabase public URL, so avatars (which are
 * only stored as a URL on users.profile_url) can still be deleted.
 */
export const getStoragePathFromUrl = (
  url: string | null | undefined
): string | null => {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  const pathPart = match?.[1];
  if (!pathPart) return null;
  try {
    return decodeURIComponent(pathPart);
  } catch {
    return pathPart;
  }
};

/**
 * Delete a file from Supabase Storage.
 * Falls back to the legacy local uploads folder for rows created before the
 * migration, so old posts/users can still be cleaned up.
 */
export const deleteFileFromStorage = async (
  storedPath: string | null | undefined
): Promise<void> => {
  if (!storedPath) return;

  if (!STORAGE_PATH_PATTERN.test(storedPath)) {
    const legacyPath = path.join("src/uploads", storedPath);
    try {
      await fs.unlink(legacyPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Failed to delete legacy file ${storedPath}:`, err);
      }
    }
    return;
  }

  try {
    const { error } = await getSupabase().storage
      .from(SUPABASE_BUCKET)
      .remove([storedPath]);
    if (error) {
      console.error(`Failed to delete ${storedPath} from Supabase:`, error.message);
    }
  } catch (err) {
    console.error(`Failed to delete ${storedPath} from Supabase:`, err);
  }
};

/** Remove every media object (and the avatar) that belongs to a user. */
export const deleteUserFiles = async (userId: number): Promise<void> => {
  const [media, user] = await Promise.all([
    prisma.media.findMany({
      where: { user_id: userId },
      select: { filename: true },
    }),
    prisma.users.findUnique({
      where: { id: userId },
      select: { profile_url: true },
    }),
  ]);

  const paths = media
    .map((m) => m.filename)
    .filter((f): f is string => Boolean(f));

  const avatarPath = getStoragePathFromUrl(user?.profile_url);

  await Promise.all([
    ...paths.map((p) => deleteFileFromStorage(p)),
    deleteFileFromStorage(avatarPath),
  ]);
};
