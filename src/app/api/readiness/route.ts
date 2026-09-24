import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { documentStorageReadiness } from "@/lib/document-storage";

export async function GET() {
  const required = [
    "DATABASE_URL",
    "PS_ADMIN_API_KEY",
    "SHOPIFY_SHOP",
    "SHOPIFY_ADMIN_ACCESS_TOKEN",
    "SHOPIFY_WEBHOOK_SECRET",
    "PUBLIC_VERIFY_BASE_URL",
    "APP_BASE_URL",
    "PUBLIC_STOREFRONT_ORIGINS",
  ];
  const missing = required.filter((key) => !process.env[key]);
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {}

  let storage: ReturnType<typeof documentStorageReadiness> | { mode: string; ready: false; error: string };
  try {
    storage = documentStorageReadiness();
  } catch (error) {
    storage = { mode: process.env.DOCUMENT_STORAGE_MODE || "local", ready: false, error: error instanceof Error ? error.message : "Storage configuration invalid" };
  }

  const ready = database && missing.length === 0 && storage.ready;
  return NextResponse.json(
    { ready, database, storage, missingEnvironmentVariables: missing },
    { status: ready ? 200 : 503 },
  );
}
