// Serves the static site, adding byte-range support for clips in /media.
// iPhone Safari only plays video from servers that answer Range requests with 206 Partial Content;
// the plain static-asset server always sends the whole file, so clips would not play on phones.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/media/") || (request.method !== "GET" && request.method !== "HEAD")) {
      return env.ASSETS.fetch(request);
    }

    const range = request.headers.get("Range");
    const full = await env.ASSETS.fetch(new Request(url, { method: "GET" }));
    if (!full.ok) return full;

    const headers = new Headers(full.headers);
    headers.set("Accept-Ranges", "bytes");
    if (!range) {
      return new Response(request.method === "HEAD" ? null : full.body, { status: 200, headers });
    }

    const body = await full.arrayBuffer();
    const size = body.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start, end;
    if (m && m[1] !== "") {
      start = +m[1];
      end = m[2] !== "" ? Math.min(+m[2], size - 1) : size - 1;
    } else if (m && m[2] !== "") {
      // suffix range: the last N bytes
      start = Math.max(0, size - +m[2]);
      end = size - 1;
    }
    if (start === undefined || start > end || start >= size) {
      headers.set("Content-Range", "bytes */" + size);
      headers.delete("Content-Length");
      return new Response(null, { status: 416, headers });
    }

    headers.set("Content-Range", "bytes " + start + "-" + end + "/" + size);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(request.method === "HEAD" ? null : body.slice(start, end + 1), { status: 206, headers });
  },
};
