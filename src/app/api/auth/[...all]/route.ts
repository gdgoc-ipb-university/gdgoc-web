import type { NextRequest } from "next/server";
import { withHostOnlyExpiries } from "@/lib/auth-cookies";
import { handler } from "@/lib/auth-server";

export const GET = async (request: NextRequest) => withHostOnlyExpiries(await handler.GET(request));
export const POST = async (request: NextRequest) => withHostOnlyExpiries(await handler.POST(request));
