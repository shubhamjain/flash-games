import { createReadStream, watch } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = join(projectRoot, "dist");
const port = Number.parseInt(process.env.PORT ?? "8788", 10);
const watching = process.argv.includes("--watch");

const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".swf": "application/x-shockwave-flash",
    ".wasm": "application/wasm",
};

function fileForRequest(url) {
    const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = normalize(join(outputDirectory, relativePath));

    return filePath.startsWith(`${outputDirectory}/`) || filePath === outputDirectory ? filePath : null;
}

const server = createServer(async (request, response) => {
    let filePath;
    try {
        filePath = fileForRequest(request.url ?? "/");
    } catch {
        response.writeHead(400).end("Bad request");
        return;
    }

    if (!filePath) {
        response.writeHead(403).end("Forbidden");
        return;
    }

    try {
        const details = await stat(filePath);
        if (!details.isFile()) {
            response.writeHead(404).end("Not found");
            return;
        }

        response.writeHead(200, {
            "Content-Length": details.size,
            "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
            "Cache-Control": "no-store",
        });
        createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404).end("Not found");
    }
});

let rebuilding = false;
let rebuildQueued = false;

async function rebuild() {
    if (rebuilding) {
        rebuildQueued = true;
        return;
    }

    rebuilding = true;
    try {
        const result = await build();
        console.log(`Rebuilt ${result.games} games.`);
    } catch (error) {
        console.error(`Rebuild failed: ${error.message}`);
    } finally {
        rebuilding = false;
        if (rebuildQueued) {
            rebuildQueued = false;
            void rebuild();
        }
    }
}

await rebuild();
server.listen(port, () => {
    console.log(`Preview available at http://localhost:${port}`);
});

if (watching) {
    const rebuildOnChange = (() => {
        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => void rebuild(), 100);
        };
    })();

    for (const source of [
        join(projectRoot, "swf.json"),
        join(projectRoot, "swfs"),
        join(projectRoot, "node_modules", "@ruffle-rs", "ruffle"),
    ]) {
        watch(source, { recursive: true }, rebuildOnChange);
    }
    console.log("Watching game data and assets for changes.");
}
