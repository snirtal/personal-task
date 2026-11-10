import { publicConfig } from "../lib/public-config.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  const config = publicConfig(process.env);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (!config) {
    response.status(503).json({ error: "Account services are not configured." });
    return;
  }
  response.status(200).json(config);
}
