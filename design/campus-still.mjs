// Captures stills of the landing's Three.js campus from a running site in headless Chrome.
// Used by design/campus-fallback.mjs and design/og-image.mjs; set CHROME_PATH if Chrome is not in /Applications.
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** The site to capture: the first command-line argument, or the local default. */
export const site = (process.argv[2] ?? "http://127.0.0.1:3104").replace(/\/+$/, "");

/** Opens a blank headless tab and returns DevTools Protocol helpers for it. Always `close()` it. */
export async function openPage() {
  const profile = await mkdtemp(join(tmpdir(), "campus-still-chrome-"));
  const chrome = spawn(chromePath, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let socket;
  const close = async () => {
    // An open socket or pipe would keep Node waiting after Chrome is gone.
    socket?.close();
    chrome.stderr.destroy();
    chrome.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    const devtools = await new Promise((resolve, reject) => {
      let log = "";
      chrome.stderr.on("data", (chunk) => {
        log += chunk;
        const match = log.match(/DevTools listening on (ws:\S+)/);
        if (match) resolve(new URL(match[1]));
      });
      chrome.once("error", reject);
      chrome.once("exit", () => reject(new Error(`Chrome exited before DevTools was ready:\n${log}`)));
    });
    const tab = await (await fetch(`http://${devtools.host}/json/new?about:blank`, { method: "PUT" })).json();
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error("Could not connect to Chrome DevTools"));
    });
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const { id, result, error } = JSON.parse(data);
      const call = pending.get(id);
      if (!call) return;
      pending.delete(id);
      if (error) call.reject(new Error(error.message));
      else call.resolve(result);
    };
    let calls = 0;
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        pending.set(++calls, { resolve, reject });
        socket.send(JSON.stringify({ id: calls, method, params }));
      });
    const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
    return { send, evaluate, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * A PNG of the campus scene alone, in the deterministic `?motion=off` pose.
 * The renderer caps its own resolution near 1.8 million pixels, so a larger viewport or scale factor is upscaled.
 */
export async function captureScene({ width, height, deviceScaleFactor = 1 }) {
  const page = await openPage();
  try {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile: false });
    await page.send("Page.navigate", { url: `${site}/environment?motion=off` });
    // `data-ready` is only set by a rendered WebGL frame, never by the static image fallback.
    for (let attempt = 0; !(await page.evaluate(`document.querySelector(".campus-environment")?.dataset.ready === "true"`)); attempt++) {
      if (attempt === 100) throw new Error(`The 3D scene did not render at ${site}/environment. Is the site running, and does this Chrome have WebGL?`);
      await sleep(200);
    }
    await page.evaluate(`document.querySelector(".environment-toolbar").style.display = "none"`);
    await sleep(500);
    const { data } = await page.send("Page.captureScreenshot", { format: "png" });
    return Buffer.from(data, "base64");
  } finally {
    await page.close();
  }
}
