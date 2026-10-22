import {createHash} from 'node:crypto';

export const WLLAMA_VERSION = '3.8.1';
export const WLLAMA_ESM_SHA256 = 'e5506753e41a59c11f61f2c52422045be9fc76e32a7e47f037aaad5df4ec723e';

/** Apply only to the pinned @wllama/wllama/esm/index.js during bundling. */
export function patchWllama381(source, version = WLLAMA_VERSION) {
  if (version !== WLLAMA_VERSION || createHash('sha256').update(source).digest('hex') !== WLLAMA_ESM_SHA256) {
    throw new Error('Wllama OPFS cleanup patch requires the exact audited @wllama/wllama 3.8.1 ESM source. Review before upgrading.');
  }
  const replaceOnce = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('Wllama cleanup patch source did not match exactly once');
    source = source.replace(before, after);
  };
  replaceOnce(`var createWorker = (workerCode) => {
  const workerURL = URL.createObjectURL(
    isString(workerCode) ? new Blob([workerCode], { type: "text/javascript" }) : workerCode
  );
  return new Worker(workerURL, { type: "module" });
};`, `var createWorker = (workerCode) => {
  const workerURL = URL.createObjectURL(
    isString(workerCode) ? new Blob([workerCode], { type: "text/javascript" }) : workerCode
  );
  let worker;
  let revoked = false;
  const revoke = () => {
    if (revoked) return;
    revoked = true;
    URL.revokeObjectURL(workerURL);
    worker?.removeEventListener("message", revoke);
    worker?.removeEventListener("error", revoke);
  };
  try {
    worker = new Worker(workerURL, { type: "module" });
    // A first event proves startup has consumed the Blob URL. Do not revoke early.
    worker.addEventListener("message", revoke, { once: true });
    worker.addEventListener("error", revoke, { once: true });
    const terminate = worker.terminate.bind(worker);
    worker.terminate = () => {
      try { return terminate(); } finally { revoke(); }
    };
    return worker;
  } catch (error) {
    revoke();
    throw error;
  }
};`);
  replaceOnce(`    yield workerExec({ action: "open", filename: fileName });
    return {`, `    try {
      yield workerExec({ action: "open", filename: fileName });
    } catch (error) {
      worker.terminate();
      throw error;
    }
    return {`);
  replaceOnce(`      close: () => __async(this, null, function* () {
        yield workerExec({ action: "close" });
        worker.terminate();
      })`, `      close: () => __async(this, null, function* () {
        try {
          yield workerExec({ action: "close" });
        } finally {
          worker.terminate();
        }
      })`);
  const declaration = source.match(/^var OPFS_UTILS_WORKER_CODE = (.*);$/m);
  if (!declaration) throw new Error('Wllama OPFS worker declaration missing');
  const workerCode = JSON.parse(declaration[1]);
  const oldClose = `async function closeFile() {
  accessHandle.flush();
  accessHandle.close();
}`;
  const newClose = `async function closeFile() {
  const handle = accessHandle;
  accessHandle = undefined;
  if (!handle) return;
  try {
    handle.flush();
  } finally {
    handle.close();
  }
}`;
  if (workerCode.split(oldClose).length !== 2) throw new Error('Wllama OPFS close function did not match exactly once');
  source = source.replace(declaration[0], `var OPFS_UTILS_WORKER_CODE = ${JSON.stringify(workerCode.replace(oldClose, newClose))};`);
  return source;
}
