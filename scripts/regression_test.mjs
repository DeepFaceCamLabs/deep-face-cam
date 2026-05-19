#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const host = process.env.TEST_BACKEND_HOST ?? "127.0.0.1";
const port = Number(process.env.TEST_BACKEND_PORT ?? 8765);
const root = resolve(import.meta.dirname, "..");
const fixtures = resolve(root, "test_data", "regression");

const paths = {
  sourcePrimary: resolve(fixtures, "source_primary.png"),
  sourceSecondary: resolve(fixtures, "source_secondary.png"),
  sourceThird: resolve(fixtures, "source_third.png"),
  targetSingle: resolve(fixtures, "target_single.png"),
  targetMulti: resolve(fixtures, "target_multi_3faces.png"),
  targetVideo: resolve(fixtures, "target_video_2s.mp4"),
};

const results = [];
let rpcId = 1;
let ws;
const pending = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fileSize(path) {
  return existsSync(path) ? statSync(path).size : 0;
}

function call(method, params = {}) {
  return new Promise((resolveCall, reject) => {
    const id = rpcId++;
    pending.set(id, { resolve: resolveCall, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitDone(label, timeoutMs = 180000) {
  const start = Date.now();
  let state = await call("get_state");
  while (state.processing) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    await wait(1000);
    state = await call("get_state");
  }
  return state;
}

async function resetBase() {
  await call("set_state", {
    patch: {
      enhancer: "None",
      many_faces: false,
      map_faces: false,
      keep_audio: false,
      keep_fps: true,
      keep_frames: false,
      poisson_blend: false,
      color_correction: false,
      nsfw_filter: false,
      mouth_mask_size: 0,
      show_mouth_mask_box: false,
      opacity: 1,
      sharpness: 0,
    },
  });
  await call("mapping_reset");
}

async function setSourceTarget(source, target) {
  const sourceResult = await call("set_source_path", { path: source });
  assert(sourceResult.ok, sourceResult.error ?? "set_source_path failed");
  const targetResult = await call("set_target_path", { path: target });
  assert(targetResult.ok, targetResult.error ?? "set_target_path failed");
}

async function preview(label) {
  const previewResult = await call("preview_frame", { frame_number: 0 });
  assert(previewResult.ok, previewResult.error ?? `${label} preview failed`);
  assert(previewResult.size > 1000, `${label} preview too small`);
}

async function generate(label, minBytes, expectedExt) {
  const started = await call("start", { auto_output: true });
  assert(started.ok, started.error ?? `${label} start failed`);
  const state = await waitDone(label);
  assert(state.output_path, `${label} missing output_path`);
  assert(state.output_path.endsWith(expectedExt), `${label} wrong extension: ${state.output_path}`);
  const size = fileSize(state.output_path);
  assert(size >= minBytes, `${label} output too small: ${size}`);
  results.push({ label, output: state.output_path, bytes: size });
}

async function run() {
  for (const [name, path] of Object.entries(paths)) {
    assert(existsSync(path), `missing fixture ${name}: ${path}`);
  }

  const health = await fetch(`http://${host}:${port}/health`).then((r) => r.json());
  assert(health.ok, `bad health response: ${JSON.stringify(health)}`);

  await resetBase();
  await setSourceTarget(paths.sourcePrimary, paths.targetSingle);
  await preview("single image");
  await generate("single image swap", 50000, ".png");

  await resetBase();
  await setSourceTarget(paths.sourcePrimary, paths.targetVideo);
  await preview("video");
  await generate("video swap", 20000, ".mp4");

  await resetBase();
  await setSourceTarget(paths.sourcePrimary, paths.targetMulti);
  await call("set_state", { patch: { many_faces: true } });
  await preview("many faces");
  await generate("many-face image swap", 50000, ".png");

  await resetBase();
  await setSourceTarget(paths.sourcePrimary, paths.targetMulti);
  await call("set_state", { patch: { map_faces: true } });
  const mapResult = await call("mapping_extract");
  assert(mapResult.ok, mapResult.error ?? "mapping_extract failed");
  assert((mapResult.map?.length ?? 0) >= 2, `expected at least 2 target faces, got ${mapResult.map?.length ?? 0}`);
  const sourceCycle = [paths.sourcePrimary, paths.sourceSecondary, paths.sourceThird];
  for (const [index, entry] of mapResult.map.entries()) {
    const setResult = await call("mapping_set_source", {
      row: entry.id,
      path: sourceCycle[index % sourceCycle.length],
    });
    assert(setResult.ok, setResult.error ?? `mapping_set_source failed for row ${entry.id}`);
  }
  const valid = await call("mapping_valid");
  assert(valid === true, "mapping_valid returned false");
  const simplified = await call("mapping_simplify");
  assert(simplified.ok, simplified.error ?? "mapping_simplify failed");
  await generate("mapped multi-face swap", 50000, ".png");

  for (const enhancer of ["GFPGAN", "GPEN-256", "GPEN-512"]) {
    await resetBase();
    await setSourceTarget(paths.sourcePrimary, paths.targetSingle);
    await call("set_state", {
      patch: {
        enhancer,
        opacity: 0.82,
        sharpness: 0.25,
        mouth_mask_size: 0.2,
        show_mouth_mask_box: false,
      },
    });
    await generate(`advanced enhancer ${enhancer}`, 50000, ".png");
  }

  const cameras = await call("list_cameras");
  results.push({ label: "camera list", output: JSON.stringify(cameras), bytes: 0 });

  return results;
}

async function main() {
  ws = new WebSocket(`ws://${host}:${port}/rpc`);
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (typeof message.id === "number") {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (!waiter) return;
      if (message.error) waiter.reject(new Error(message.error));
      else waiter.resolve(message.result);
    }
  };
  await new Promise((resolveOpen, reject) => {
    ws.onopen = resolveOpen;
    ws.onerror = () => reject(new Error("websocket connection failed"));
  });
  await wait(300);

  try {
    const summary = await run();
    console.log(JSON.stringify({ ok: true, results: summary }, null, 2));
  } finally {
    ws.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
