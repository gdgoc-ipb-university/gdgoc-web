import type { NextRequest } from "next/server";
import { withHostOnlyExpiries } from "@/lib/auth-cookies";
import { handler } from "@/lib/auth-server";
import { withClientIp } from "@/lib/client-ip";

export const GET = async (request: NextRequest) => withHostOnlyExpiries(await handler.GET(withClientIp(request)));
export const POST = async (request: NextRequest) => withHostOnlyExpiries(await handler.POST(withClientIp(request)));
