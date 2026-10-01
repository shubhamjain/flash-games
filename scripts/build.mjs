import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(projectRoot, "dist");
const gamesDirectory = join(outputDirectory, "games");
const swfsDirectory = join(projectRoot, "swfs");

const escapeHtml = (value) =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

function assertSafeName(value, field, index) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new Error(`Game ${index + 1} has an invalid ${field}. Use letters, numbers, underscores, or hyphens.`);
    }
}

function assertSwfName(value, index) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]+\.swf$/i.test(value)) {
        throw new Error(`Game ${index + 1} has an invalid swf. Use a plain .swf filename.`);
    }
}

async function readGames() {
    const source = await readFile(join(projectRoot, "swf.json"), "utf8");
    const games = JSON.parse(source);

    if (!Array.isArray(games)) {
        throw new Error("swf.json must contain an array of games.");
    }

    return games.map((game, index) => {
        assertSafeName(game.permalink, "permalink", index);
        assertSwfName(game.swf, index);

        if (typeof game.game_title !== "string" || game.game_title.trim() === "") {
            throw new Error(`Game ${index + 1} must include a game_title.`);
        }

        return { ...game, swf: game.swf };
    });
}

function renderIndex(games) {
    const cards = games
        .map(
            ({ permalink, game_title, thumbnail }, index) => `
                <a class="game-card" href="/games/${permalink}.html" style="--hue: ${index * 34 + 190}deg">
                    <div class="game-art${thumbnail ? " has-thumbnail" : ""}" aria-hidden="true">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy">` : ""}<span>${String(index + 1).padStart(2, "0")}</span><b>▶</b></div>
                    <div class="game-copy">
                        <h2>${escapeHtml(game_title)}</h2>
                    </div>
                </a>`,
        )
        .join("\n");

    return `<!doctype html>
<html lang="en" data-ruffle-optout>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0b1020">
        <title>Ruffle Arcade — Flash games</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            :root { color-scheme: dark; --ink: #e8ebf2; --muted: #8f98ae; --line: rgba(255,255,255,.09); --panel: rgba(25,30,44,.78); --accent: #a8dfcf; }
            * { box-sizing: border-box; }
            a {
             text-underline-offset: 3px;
            }
            body { background: #111522; color: var(--ink); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; min-height: 100vh; overflow-x: hidden; }
            body::before { background: radial-gradient(circle at 13% 8%, rgba(99,102,241,.14), transparent 32%), radial-gradient(circle at 84% 0%, rgba(45,212,191,.1), transparent 28%); content: ""; inset: 0; pointer-events: none; position: fixed; z-index: -1; }
            .shell { margin: 0 auto; max-width: 1240px; padding: 0 28px; }
            .topbar { align-items: center; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; min-height: 76px; }
            .brand { align-items: center; color: var(--ink); display: inline-flex; font-size: 14px; font-weight: 700; gap: 11px; letter-spacing: .16em; text-decoration: none; }
            .brand-mark { align-items: center; background: var(--accent); border-radius: 9px; color: #0b1020; display: inline-flex; font-size: 15px; height: 32px; justify-content: center; transform: rotate(-7deg); width: 32px; }
            .topbar-note { color: var(--muted); font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
            .hero { padding: 62px 0 12px; text-align: center; }
            .eyebrow { color: var(--accent); font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: .16em; margin: 0 0 18px; text-transform: uppercase; }
            h1 { font-size: clamp(34px, 5vw, 60px); font-weight: 600; letter-spacing: -.045em; line-height: 1; margin: 0 auto; max-width: 780px; }
            .hero-row { align-items: center; display: flex; flex-direction: column; gap: 20px; justify-content: center; margin-top: 22px; }
            .hero-copy { color: var(--muted); font-size: 15px; line-height: 1.55; margin: 0 auto; max-width: 560px; }
            .count { border-left: 0;  color: var(--muted); font-family: "DM Mono", monospace; font-size: 11px; line-height: 1.5; padding: 12px 0 0; text-transform: uppercase; white-space: nowrap;    text-align: right; margin-top: 20px; width: 100%;}
            .count strong { color: var(--ink); }
            .section-label { align-items: center; color: var(--muted); display: flex; font-family: "DM Mono", monospace; font-size: 11px; gap: 12px; justify-content: center; letter-spacing: .12em; margin: 0 0 18px; text-transform: uppercase; }
            .section-label::after { background: var(--line); content: ""; height: 1px; width: 60px; }
            .game-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-bottom: 64px; }
            .game-card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; color: var(--ink); display: flex; flex-direction: column; overflow: hidden; position: relative; text-decoration: none; transition: border-color .25s, transform .25s, box-shadow .25s; }
            .game-card:hover { border-color: rgba(141,245,208,.65); box-shadow: 0 20px 55px rgba(0,0,0,.28); transform: translateY(-5px); }
            .game-art { align-items: flex-end; aspect-ratio: 1 / .76; background: linear-gradient(135deg, hsl(var(--hue) 54% 48% / .95), hsl(calc(var(--hue) + 55deg) 48% 34% / .95)); display: flex; justify-content: space-between; overflow: hidden; padding: 10px 12px; position: relative; }
            .game-art::before, .game-art::after { border: 1px solid rgba(255,255,255,.35); border-radius: 50%; content: ""; height: 190px; position: absolute; right: -46px; top: -80px; width: 190px; }
            .game-art::after { height: 100px; right: 60px; top: 62px; width: 100px; }
            .game-art img { height: 100%; inset: 0; object-fit: cover; position: absolute; width: 100%; z-index: 0; }
            .game-art.has-thumbnail::after { background: linear-gradient(135deg, rgba(5,8,18,.08), rgba(5,8,18,.72)); border: 0; border-radius: 0; height: auto; inset: 0; right: auto; top: auto; width: auto; z-index: 0; }
            .game-art span { color: rgba(6,14,35,.58); font-family: "DM Mono", monospace; font-size: 12px; font-weight: 500; position: relative; z-index: 1; }
            .game-art b { align-items: center; background: rgba(8,14,33,.88); border-radius: 50%; color: var(--accent); display: flex; font-size: 15px; height: 42px; justify-content: center; padding-left: 3px; position: relative; width: 42px; z-index: 1; }
            .game-copy { align-items: center; display: flex; flex: 1; justify-content: center; padding: 20px 12px; text-align: center;  font-family: "DM Mono";}
            .game-copy h2 { font-size: 15px; letter-spacing: -.02em; line-height: 1.15; margin: 0; max-width: 100%; }
            footer { border-top: 1px solid var(--line); color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .07em; padding: 22px 0 30px; text-align: center; text-transform: uppercase; }
            @media (max-width: 820px) { .game-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 560px) { .shell { padding: 0 18px; } .topbar-note { display: none; } .hero { padding: 54px 0 40px; } .game-grid { grid-template-columns: 1fr; } }
        </style>
    </head>
    <body>
        <div class="shell">
            <main>
                <section class="hero">
                    <h1>Nostalgic Flash Games</h1>
                    <div class="hero-row">
                        <p class="hero-copy">Small collection of Flash games I played as an Indian teenager in the 2000s. Thanks to <a href="https://ruffle.rs/">@Ruffle</a> for making these available.</p>
                        <div class="count"><strong>${games.length}</strong> games available</div>
                    </div>
                </section>
                <section class="game-grid" aria-label="Game library">
${cards}
                </section>
            </main>
            <footer>Created by <a href="https://shubhamjain.co/">@shubhamjainco</a></footer>
        </div>
    </body>
</html>
`;
}

function renderGame({ game_title, swf }) {
    const title = escapeHtml(game_title);
    const swfPath = `/swfs/${swf}`;

    return `<!doctype html>
<html lang="en" data-ruffle-optout>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0b1020">
        <title>${title} — Ruffle Arcade</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            :root { color-scheme: dark; --ink: #e8ebf2; --muted: #8f98ae; --line: rgba(255,255,255,.09); --panel: rgba(25,30,44,.78); --accent: #a8dfcf; }
            * { box-sizing: border-box; }
            body { background: #111522; color: var(--ink); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; min-height: 100vh; }
            body::before { background: radial-gradient(circle at 12% 0%, rgba(99,102,241,.12), transparent 32%), radial-gradient(circle at 88% 8%, rgba(45,212,191,.08), transparent 28%); content: ""; inset: 0; pointer-events: none; position: fixed; z-index: -1; }
            .shell { margin: 0 auto; max-width: 1240px; padding: 0 28px; }
            .topbar { align-items: center; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; min-height: 76px; }
            .brand { align-items: center; color: var(--ink); display: inline-flex; font-size: 14px; font-weight: 700; gap: 11px; letter-spacing: .16em; text-decoration: none; }
            .brand-mark { align-items: center; background: var(--accent); border-radius: 9px; color: #0b1020; display: inline-flex; font-size: 15px; height: 32px; justify-content: center; transform: rotate(-7deg); width: 32px; }
            .back { color: var(--muted); display: block; font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: .08em; margin: 0 0 30px; text-align: center; text-decoration: none; text-transform: uppercase; }
            .back:hover { color: var(--accent); }
            main { padding: 44px 0 56px; }
            .crumb { color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .12em; margin: 0 0 14px; text-align: center; text-transform: uppercase; }
            .game-heading { align-items: center; display: flex; flex-direction: column; gap: 14px; justify-content: center; margin-bottom: 22px; text-align: center; }
            h1 { font-size: clamp(30px, 4.5vw, 54px); font-weight: 600; letter-spacing: -.045em; line-height: 1; margin: 0; }
            .status { border: 1px solid rgba(141,245,208,.4); border-radius: 99px; color: var(--accent); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .1em; padding: 8px 11px; text-transform: uppercase; white-space: nowrap; }
            #player-frame { background: #050811; border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 30px 80px rgba(0,0,0,.35); overflow: hidden; padding: 10px; }
            #player-container { align-items: center; background: #02040a; border-radius: 13px; display: flex; height: min(70vh, 720px); justify-content: center; min-height: 360px; overflow: hidden; position: relative; width: 100%; }
            #player-container::before { background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 32px 32px; content: ""; inset: 0; pointer-events: none; position: absolute; }
            ruffle-player { max-height: 100%; max-width: 100%; position: relative; }
            #loading { color: var(--muted); font-family: "DM Mono", monospace; font-size: 11px; letter-spacing: .08em; margin: 0; position: absolute; text-align: center; text-transform: uppercase; z-index: 1; }
            #loading.error { color: #ff9b9b; }
            .game-footer { align-items: center; color: var(--muted); display: flex; flex-direction: column; font-family: "DM Mono", monospace; font-size: 10px; gap: 9px; justify-content: center; letter-spacing: .07em; padding-top: 18px; text-align: center; text-transform: uppercase; }
            @media (max-width: 560px) { .shell { padding: 0 18px; } main { padding-top: 34px; } #player-frame { padding: 6px; } #player-container { min-height: 260px; } .game-footer { line-height: 1.5; } }
        </style>
    </head>
    <body>
        <div class="shell">
            <main>
                <a class="back" href="/">← Back to library</a>
                <section id="player-frame" aria-label="${title} game player">
                    <div id="player-container"><p id="loading">Loading game · please wait</p></div>
                </section>
                <div class="game-footer"><span>Audio may start muted by your browser</span><span>Ruffle emulation</span></div>
            </main>
        </div>
        <script src="/ruffle/ruffle.js"></script>
        <script>
            window.addEventListener("DOMContentLoaded", async () => {
                const ruffle = window.RufflePlayer?.newest();
                const loading = document.querySelector("#loading");
                const container = document.querySelector("#player-container");

                if (!ruffle) {
                    loading.classList.add("error");
                    loading.textContent = "The Ruffle player failed to load.";
                    return;
                }

                const player = ruffle.createPlayer();
                const resizePlayer = () => {
                    const bounds = container.getBoundingClientRect();
                    player.setAttribute("width", String(Math.floor(bounds.width)));
                    player.setAttribute("height", String(Math.floor(bounds.height)));
                };
                container.append(player);
                resizePlayer();
                window.addEventListener("resize", resizePlayer);

                try {
                    await player.load(${JSON.stringify(swfPath)});
                    loading.remove();
                    window.setTimeout(() => player.playButton?.click(), 50);
                } catch (error) {
                    console.error(error);
                    loading.classList.add("error");
                    loading.textContent = "This game could not be loaded.";
                }
            });
        </script>
    </body>
</html>
`;
}

async function findFirstFile(paths) {
    for (const path of paths) {
        try {
            if ((await stat(path)).isFile()) {
                return path;
            }
        } catch {
            // Try the next possible asset location.
        }
    }
    return null;
}

async function copyRuntime() {
    const packageDirectory = join(projectRoot, "node_modules", "@ruffle-rs", "ruffle");
    const runtimeDirectory = join(outputDirectory, "ruffle");

    try {
        await stat(packageDirectory);
    } catch {
        throw new Error("Ruffle is not installed. Run npm install before building the site.");
    }

    await mkdir(runtimeDirectory, { recursive: true });
    const packageFiles = await readdir(packageDirectory, { withFileTypes: true });
    const runtimeFiles = packageFiles.filter(
        (entry) => entry.isFile() && /\.(?:js|wasm)$/i.test(entry.name),
    );

    if (!runtimeFiles.some(({ name }) => name === "ruffle.js") || !runtimeFiles.some(({ name }) => name.endsWith(".wasm"))) {
        throw new Error("The installed Ruffle package does not contain a usable self-hosted runtime.");
    }

    await Promise.all(
        runtimeFiles.map(({ name }) => cp(join(packageDirectory, name), join(runtimeDirectory, name))),
    );
}

export async function build() {
    const games = await readGames();

    await rm(outputDirectory, { force: true, recursive: true });
    await mkdir(gamesDirectory, { recursive: true });
    await writeFile(join(outputDirectory, "index.html"), renderIndex(games));

    for (const game of games) {
        const swf = join(swfsDirectory, game.swf);
        if (!(await findFirstFile([swf]))) {
            throw new Error(`Missing SWF for “${game.game_title}”: swfs/${game.swf}`);
        }
        await writeFile(join(gamesDirectory, `${game.permalink}.html`), renderGame(game));
    }

    await Promise.all([
        cp(swfsDirectory, join(outputDirectory, "swfs"), {
            filter: (source) => !basename(source).startsWith("."),
            recursive: true,
        }),
        copyRuntime(),
    ]);
    await writeFile(join(outputDirectory, "_headers"), "/ruffle/*.wasm\n  Content-Type: application/wasm\n");
    return { games: games.length, outputDirectory };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    build()
        .then(({ games, outputDirectory: destination }) => {
            console.log(`Built ${games} games in ${destination}`);
        })
        .catch((error) => {
            console.error(`Build failed: ${error.message}`);
            process.exitCode = 1;
        });
}
