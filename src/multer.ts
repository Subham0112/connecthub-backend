import multer from "multer";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file (matches bucket limit)

// Files are kept in memory only long enough to be streamed to Supabase
// Storage — nothing is written to the server's local filesystem anymore.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image and video files are allowed"));
  },
});

export default upload;
