import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type StoredDocument = {
  storageRef: string;
  fileName: string;
  mimeType: string;
  size: number;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "document";
}

function storageMode(): "local" | "s3" {
  const mode = (process.env.DOCUMENT_STORAGE_MODE || "local").toLowerCase();
  if (mode !== "local" && mode !== "s3") throw new Error(`Unsupported document storage mode: ${mode}`);
  if (process.env.NODE_ENV === "production" && mode === "local" && process.env.ALLOW_LOCAL_DOCUMENT_STORAGE !== "true") {
    throw new Error("Local document storage is disabled in production. Configure S3-compatible private object storage before launch.");
  }
  return mode;
}

function localRoot() {
  return path.resolve(process.env.DOCUMENT_STORAGE_DIR || "./storage/batch-documents");
}

function s3Config() {
  const bucket = process.env.DOCUMENT_S3_BUCKET;
  const region = process.env.DOCUMENT_S3_REGION || "us-east-1";
  if (!bucket) throw new Error("DOCUMENT_S3_BUCKET is required when DOCUMENT_STORAGE_MODE=s3");
  const endpoint = process.env.DOCUMENT_S3_ENDPOINT || undefined;
  const forcePathStyle = process.env.DOCUMENT_S3_FORCE_PATH_STYLE === "true";
  return { bucket, client: new S3Client({ region, endpoint, forcePathStyle }) };
}

export async function storeBatchDocument(args: {
  psLotNumber: string;
  documentType: string;
  versionNumber: number;
  file: File;
}): Promise<StoredDocument> {
  const fileName = args.file.name || "document";
  const safe = safeFileName(fileName);
  const objectKey = `${args.psLotNumber}/${args.documentType.toLowerCase()}/v${args.versionNumber}-${randomUUID()}-${safe}`;
  const bytes = Buffer.from(await args.file.arrayBuffer());

  if (storageMode() === "local") {
    const absolute = path.join(localRoot(), objectKey);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes, { flag: "wx" });
    return { storageRef: `local:${objectKey}`, fileName, mimeType: args.file.type, size: args.file.size };
  }

  const { bucket, client } = s3Config();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: bytes,
    ContentType: args.file.type || "application/octet-stream",
    Metadata: { ps_lot_number: args.psLotNumber, document_type: args.documentType },
  }));
  return { storageRef: `s3:${objectKey}`, fileName, mimeType: args.file.type, size: args.file.size };
}

export async function readStoredDocument(storageRef: string): Promise<Buffer> {
  if (storageRef.startsWith("local:")) {
    const key = storageRef.slice("local:".length);
    const normalized = path.normalize(key);
    if (normalized.startsWith("..") || path.isAbsolute(normalized)) throw new Error("Invalid local storage reference");
    return readFile(path.join(localRoot(), normalized));
  }

  if (storageRef.startsWith("s3:")) {
    const key = storageRef.slice("s3:".length);
    const { bucket, client } = s3Config();
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new Error("Stored document body is empty");
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  throw new Error("Unknown document storage reference");
}

export function documentStorageReadiness() {
  const mode = storageMode();
  if (mode === "local") return { mode, ready: process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_DOCUMENT_STORAGE === "true" };
  const missing = ["DOCUMENT_S3_BUCKET", "DOCUMENT_S3_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].filter((name) => !process.env[name]);
  return { mode, ready: missing.length === 0, missing };
}
