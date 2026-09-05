import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const serverEntry = path.join(standaloneRoot, "server.js");
const dataDirectory = await mkdtemp(path.join(tmpdir(), "jura-agent-smoke-"));
const port = Number(process.env.STORAGE_SMOKE_PORT ?? 3217);
const baseUrl = `http://127.0.0.1:${port}`;
const setupToken = "local-storage-smoke-setup-token-32-characters";
let child;
let logs = "";

async function waitForExit(target, timeoutMs = 5_000) {
  if (target.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => target.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function stopServer() {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await waitForExit(child);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
}

async function startServer(includeSetupToken) {
  logs = "";
  child = spawn(process.execPath, [serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      DEMO_MODE: "false",
      DATA_DIR: dataDirectory,
      SETUP_TOKEN: includeSetupToken ? setupToken : "",
      APP_URL: baseUrl,
      OPENAI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server wurde vorzeitig beendet.\n${logs}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The server can legitimately refuse connections while starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server wurde nicht rechtzeitig bereit.\n${logs}`);
}

async function jsonRequest(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { Origin: baseUrl, ...(options.headers ?? {}) },
  });
  const payload = response.status === 204 ? null : await response.json();
  return { response, payload };
}

async function login(email, password) {
  const { response, payload } = await jsonRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, JSON.stringify(payload));
  const cookieHeader = response.headers.get("set-cookie");
  assert.ok(cookieHeader, "Login muss ein Session-Cookie setzen.");
  return cookieHeader.split(";", 1)[0];
}

try {
  await startServer(true);

  const initialHealth = await jsonRequest("/api/health");
  assert.equal(initialHealth.response.status, 200);
  assert.equal(initialHealth.payload.integrations.localDatabase, true);
  assert.equal(initialHealth.payload.accountsConfigured, false);
  const protectedPage = await fetch(`${baseUrl}/`, { redirect: "manual" });
  assert.equal(protectedPage.status, 307);
  assert.equal(protectedPage.headers.get("location"), "/login");
  const setupPage = await fetch(`${baseUrl}/setup`);
  assert.equal(setupPage.status, 200);
  assert.match(await setupPage.text(), /Ersteinrichtung/);

  const setup = await jsonRequest("/api/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setupToken,
      users: [
        { displayName: "Erste Person", email: "eins@example.test", password: "SehrSicheresPasswort-1" },
        { displayName: "Zweite Person", email: "zwei@example.test", password: "SehrSicheresPasswort-2" },
      ],
    }),
  });
  assert.equal(setup.response.status, 201, JSON.stringify(setup.payload));
  const repeatedSetup = await fetch(`${baseUrl}/setup`, { redirect: "manual" });
  assert.equal(repeatedSetup.status, 307);
  assert.equal(repeatedSetup.headers.get("location"), "/login");

  const firstCookie = await login("eins@example.test", "SehrSicheresPasswort-1");
  const authenticatedPage = await fetch(`${baseUrl}/`, { headers: { Cookie: firstCookie }, redirect: "manual" });
  assert.equal(authenticatedPage.status, 200);
  const form = new FormData();
  form.set("file", new File(["Testnotiz zum Verwaltungsrecht"], "notiz.txt", { type: "text/plain" }));
  const uploaded = await jsonRequest("/api/documents/analyze", {
    method: "POST",
    headers: { Cookie: firstCookie },
    body: form,
  });
  assert.equal(uploaded.response.status, 200, JSON.stringify(uploaded.payload));
  assert.match(uploaded.payload.document.id, /^[0-9a-f-]{36}$/);

  const firstList = await jsonRequest("/api/documents", { headers: { Cookie: firstCookie } });
  assert.equal(firstList.response.status, 200);
  assert.equal(firstList.payload.documents.length, 1);

  const secondCookie = await login("zwei@example.test", "SehrSicheresPasswort-2");
  const secondList = await jsonRequest("/api/documents", { headers: { Cookie: secondCookie } });
  assert.equal(secondList.response.status, 200);
  assert.equal(secondList.payload.documents.length, 0, "Konten dürfen keine fremden Dokumente sehen.");

  await stopServer();
  await startServer(false);

  const runtimeConfig = await jsonRequest("/api/config");
  assert.equal(runtimeConfig.payload.setupRequired, false);
  assert.equal(runtimeConfig.payload.setupAvailable, false);

  const persistedCookie = await login("eins@example.test", "SehrSicheresPasswort-1");
  const persistedList = await jsonRequest("/api/documents", { headers: { Cookie: persistedCookie } });
  assert.equal(persistedList.response.status, 200);
  assert.equal(persistedList.payload.documents.length, 1, "Dokumente müssen einen Neustart überleben.");

  const documentId = persistedList.payload.documents[0].id;
  const deleted = await jsonRequest(`/api/documents/${documentId}`, {
    method: "DELETE",
    headers: { Cookie: persistedCookie },
  });
  assert.equal(deleted.response.status, 204);
  const remainingUploadEntries = await readdir(path.join(dataDirectory, "uploads"), { recursive: true });
  assert.equal(remainingUploadEntries.filter((entry) => !entry.endsWith(path.sep)).length <= 1, true);

  process.stdout.write("Lokaler Speicher-, Konto- und Persistenz-Smoke-Test erfolgreich.\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n${logs}`);
  process.exitCode = 1;
} finally {
  await stopServer();
  await rm(dataDirectory, { recursive: true, force: true });
}
