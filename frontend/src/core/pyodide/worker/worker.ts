/* Copyright 2024 Marimo. All rights reserved. */

import { bootstrap, startSession } from "./bootstrap";
import type { PyodideInterface } from "pyodide";
import {
  RawBridge,
  SerializedBridge,
  WorkerClientPayload,
  WorkerServerPayload,
} from "./types";
import { invariant } from "../../../utils/invariant";
import { Deferred } from "../../../utils/Deferred";
import { syncFileSystem } from "./fs";
import { MessageBuffer } from "./message-buffer";
import { prettyError } from "../../../utils/errors";

declare const self: Window & {
  pyodide: PyodideInterface;
};

// Initialize pyodide
async function loadPyodideAndPackages() {
  // @ts-expect-error ehh TypeScript
  await import("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");
  try {
    self.pyodide = await bootstrap();
  } catch (error) {
    console.error("Error bootstrapping", error);
    postMessage({ type: "initialized-error", error: prettyError(error) });
  }
}
const pyodideReadyPromise = loadPyodideAndPackages();
const messageBuffer = new MessageBuffer((m: string) =>
  postMessage({ type: "message", message: m }),
);

// Initialize the session
const bridgeReady = new Deferred<SerializedBridge>();
let started = false;
function startSessionWithCode(opts: {
  code: string | null;
  fallbackCode: string;
  filename: string | null;
}) {
  if (started) {
    return;
  }
  started = true;
  startSession(self.pyodide, opts, messageBuffer.push).then((bridge) => {
    bridgeReady.resolve(bridge);
    postMessage({ type: "initialized" });
  });
}

async function getBridge() {
  return bridgeReady.promise;
}

self.onmessage = async (event: MessageEvent<WorkerServerPayload>) => {
  // make sure loading is done
  await pyodideReadyPromise;

  // Start the session
  if (event.data.type === "set-code") {
    startSessionWithCode(event.data);
    return;
  }

  if (event.data.type === "start-messages") {
    // Flush the message buffer
    messageBuffer.start();

    return;
  }

  const { id, functionName, payload } = event.data;
  try {
    // Special case for loading packages
    if (functionName === "load_packages") {
      invariant(
        typeof payload === "string",
        "Expected a string payload for load_packages",
      );
      await self.pyodide.loadPackagesFromImports(payload, {
        messageCallback: console.log,
        errorCallback: console.error,
      });

      postMessage({ type: "response", response: null, id });
      return;
    }
    // Special case for reading a file
    if (functionName === "read_file") {
      invariant(
        typeof payload === "string",
        "Expected a string payload for read_file",
      );
      const file = self.pyodide.FS.readFile(payload, { encoding: "utf8" });
      postMessage({ type: "response", response: file, id });
      return;
    }

    // Special case for installing the interrupt buffer
    if (functionName == "set_interrupt_buffer") {
      invariant(
        payload instanceof Uint8Array,
        "Expected a Uint8Array payload for interrupt",
      );
      self.pyodide.setInterruptBuffer(payload);
      postMessage({ type: "response", response: null, id });
      return;
    }
    // Special case to lazily install black on format
    // Don't return early; still need to ask the pyodide kernel to run
    // the formatter
    if (functionName === "format") {
      await self.pyodide.runPythonAsync(`
        import micropip

        try:
          import black
        except ModuleNotFoundError:
          await micropip.install("black")
        `);
    }

    // Perform the function call to the Python bridge
    const bridge = await getBridge();
    // Serialize the payload
    const payloadString =
      payload == null
        ? null
        : typeof payload === "string"
          ? payload
          : JSON.stringify(payload);
    // Make the request
    const response =
      payloadString == null
        ? // @ts-expect-error ehh TypeScript
          await bridge[functionName]()
        : // @ts-expect-error ehh TypeScript
          await bridge[functionName](payloadString);

    // Post the response back to the main thread
    postMessage({
      type: "response",
      response: typeof response === "string" ? JSON.parse(response) : response,
      id,
    });

    // Sync the filesystem if we're saving, creating, deleting, or renaming a file
    if (namesThatRequireSync.has(functionName)) {
      await syncFileSystem(self.pyodide);
    }
  } catch (error) {
    console.error("Error in worker", error);
    if (error instanceof Error) {
      postMessage({ type: "error", error: error.message, id });
    } else {
      postMessage({ type: "error", error: String(error), id });
    }
  }
};

const namesThatRequireSync = new Set<keyof RawBridge>([
  "save",
  "rename_file",
  "create_file_or_directory",
  "delete_file_or_directory",
  "update_file_or_directory",
]);

function postMessage(message: WorkerClientPayload) {
  self.postMessage(message);
}

postMessage({ type: "ready" });
