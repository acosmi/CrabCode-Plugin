#!/usr/bin/env bun
// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// src/bootstrap.ts
import { fileURLToPath } from "url";

// src/environmentIsolation.ts
var RUNTIME_ENVIRONMENT_NAMES = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "USER",
  "LOGNAME",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  "LC_ADDRESS",
  "LC_COLLATE",
  "LC_IDENTIFICATION",
  "LC_MEASUREMENT",
  "LC_MESSAGES",
  "LC_MONETARY",
  "LC_NAME",
  "LC_NUMERIC",
  "LC_PAPER",
  "LC_TELEPHONE",
  "LC_TIME",
  "TZ",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "FORCE_COLOR",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "USERPROFILE",
  "LOCALAPPDATA",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_RUNTIME_DIR",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS"
];
var HTML_VIDEO_CONFIGURATION_NAMES = [
  "CRABCODE_PLUGIN_ROOT",
  "CRABCODE_PLUGIN_DATA",
  "CRABCODE_HTML_VIDEO_DATA",
  "CRABCODE_HTML_VIDEO_AUDIO_ROOTS",
  "CRABCODE_HTML_VIDEO_MAX_CONCURRENT_RENDERS",
  "CRABCODE_HTML_VIDEO_PREVIEW_TIMEOUT_MS",
  "CRABCODE_HTML_VIDEO_WALL_TIMEOUT_MS",
  "CRABCODE_HTML_VIDEO_RENDER_MODE",
  "CRABCODE_HTML_VIDEO_PRODUCER_URL",
  "CRABCODE_CHROME_MIRROR",
  "CRABCODE_FFMPEG_PATH",
  "CRABCODE_FFPROBE_PATH",
  "HYPERFRAMES_BROWSER_PATH",
  "HYPERFRAMES_FFMPEG_PATH",
  "HYPERFRAMES_FFPROBE_PATH",
  "HYPERFRAMES_FONT_CACHE_DIR",
  "HYPERFRAMES_DEBUG_GPU_PROBE",
  "PRODUCER_HEADLESS_SHELL_PATH",
  "PRODUCER_BEGINFRAME_PROBE_TIMEOUT_MS",
  "PRODUCER_DEBUG_SEEK_DIAGNOSTICS",
  "PRODUCER_DISABLE_HEALTH_WORKER",
  "PRODUCER_EXPERIMENTAL_FAST_CAPTURE",
  "PRODUCER_MAX_CONCURRENT_RENDERS",
  "PRODUCER_OUTPUT_ARTIFACT_TTL_MS",
  "PRODUCER_RENDER_SEEK_STEP",
  "PRODUCER_RUNTIME_RENDER_SEEK_MODE",
  "PRODUCER_RUNTIME_RENDER_SEEK_OFFSET_FRACTION",
  "PUPPETEER_EXECUTABLE_PATH",
  "CHROME_PATH",
  "FFMPEG_PATH",
  "FFPROBE_PATH"
];
var WORKER_TOKEN_ENVIRONMENT_NAMES = [
  "CRABCODE_HTML_VIDEO_PRODUCER_TOKEN",
  "CRABCODE_HTML_VIDEO_WORKER_TOKEN",
  "HTML_VIDEO_WORKER_TOKEN"
];
var SIDECAR_ENVIRONMENT_MARKER = "CRABCODE_HTML_VIDEO_ENV_SANITIZED";
var exactAllowedNames = new Set([
  ...RUNTIME_ENVIRONMENT_NAMES,
  ...HTML_VIDEO_CONFIGURATION_NAMES,
  ...WORKER_TOKEN_ENVIRONMENT_NAMES
]);
var exactWorkerTokenNames = new Set(WORKER_TOKEN_ENVIRONMENT_NAMES);
var CREDENTIAL_SHAPED_NAME = /(?:^|_)(?:API_?KEY|ACCESS_?KEY(?:_ID)?|KEY(?:_ID)?|SECRET(?:_?ACCESS)?(?:_?KEY)?|PRIVATE_?KEY|CLIENT_?SECRET|PASSWORD|PASSWD|AUTH_?TOKEN|SESSION_?TOKEN|BEARER|CREDENTIALS?)(?:$|_)/i;
function isCredentialShapedEnvironmentName(name) {
  return CREDENTIAL_SHAPED_NAME.test(name) || /(?:^|_)TOKEN(?:$|_)/i.test(name);
}
function isAllowedSidecarEnvironmentName(name) {
  if (exactWorkerTokenNames.has(name))
    return true;
  if (isCredentialShapedEnvironmentName(name))
    return false;
  return exactAllowedNames.has(name);
}
function sanitizeSidecarEnvironment(environment) {
  const allowedEntries = Object.entries(environment).filter(([name, value]) => value !== undefined && isAllowedSidecarEnvironmentName(name));
  for (const name of Object.keys(environment))
    delete environment[name];
  for (const [name, value] of allowedEntries)
    environment[name] = value;
  environment[SIDECAR_ENVIRONMENT_MARKER] = "1";
}
function unexpectedCredentialEnvironmentNames(environment = process.env) {
  return Object.keys(environment).filter((name) => isCredentialShapedEnvironmentName(name) && !exactWorkerTokenNames.has(name)).sort();
}
function unexpectedSidecarEnvironmentNames(environment = process.env) {
  return Object.keys(environment).filter((name) => name !== SIDECAR_ENVIRONMENT_MARKER && name !== "PRODUCER_HYPERFRAME_MANIFEST_PATH" && !isAllowedSidecarEnvironmentName(name)).sort();
}
function sidecarEnvironmentIsolationStatus(environment = process.env) {
  return {
    sanitized: environment[SIDECAR_ENVIRONMENT_MARKER] === "1",
    unexpectedCredentialNames: unexpectedCredentialEnvironmentNames(environment),
    unexpectedEnvironmentNames: unexpectedSidecarEnvironmentNames(environment)
  };
}

// src/bootstrap.ts
sanitizeSidecarEnvironment(process.env);
process.env.PRODUCER_HYPERFRAME_MANIFEST_PATH = fileURLToPath(new URL("./hyperframe.manifest.json", import.meta.url));
var serverUrl = new URL("./server.js", import.meta.url);
await import(serverUrl.href);
