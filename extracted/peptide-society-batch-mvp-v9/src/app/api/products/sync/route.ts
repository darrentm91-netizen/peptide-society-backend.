import { NextResponse } from "next/server";
import { isAuthResponse, requireAdmin } from "@/lib/admin-auth";
import { syncShopifyProducts } from "@/services/sync-shopify-products";
export async function POST(request:Request){const admin=requireAdmin(request);if(isAuthResponse(admin))return admin;try{const products=await syncShopifyProducts();return NextResponse.json({synced:products.length,products,actor:admin.userId});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Product sync failed"},{status:500});}}
