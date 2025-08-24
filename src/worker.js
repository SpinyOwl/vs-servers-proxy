const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

export default {
    async fetch(request, env, ctx) {
        // Handle preflight
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS });
        }

        const upstream = "https://masterserver.vintagestory.at/api/v1/servers/list";

        // Use Workers cache (data-center local) for 60s
        // Docs: caches.default API
        const cache = caches.default;                       // :contentReference[oaicite:5]{index=5}
        const cacheKey = new Request(upstream, { method: "GET" });

        let cached = await cache.match(cacheKey);
        if (cached) {
            // Add CORS on the way out
            const out = new Response(cached.body, cached);
            out.headers.set("Access-Control-Allow-Origin", "*");
            return out;
        }

        // Fetch and hint CDN to cache 60s (plus put into Workers cache)
        // Note: JSON/HTML aren’t cached by default at CDN without directives. :contentReference[oaicite:6]{index=6}
        const resp = await fetch(upstream, { cf: { cacheTtl: 60, cacheEverything: true } });

        // Normalize headers and set caching & CORS
        const out = new Response(resp.body, resp);
        out.headers.set("Access-Control-Allow-Origin", "*");
        out.headers.set("Cache-Control", "public, s-maxage=60, max-age=60");

        // Write to Workers cache in background
        ctx.waitUntil(cache.put(cacheKey, out.clone()));    // How cache works: :contentReference[oaicite:7]{index=7}
        return out;
    }
};
