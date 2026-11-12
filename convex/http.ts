import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { prefix, read } from "./botApi";

const http = httpRouter();
authComponent.registerRoutes(http, createAuth);
// The chapter bot's read-only API (#259, docs/BOT_API.md).
http.route({ pathPrefix: prefix, method: "GET", handler: read });
export default http;
