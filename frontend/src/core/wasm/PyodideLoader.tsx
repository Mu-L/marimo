/* Copyright 2024 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import type React from "react";
import type { PropsWithChildren } from "react";
import { LargeSpinner } from "@/components/icons/large-spinner";
import { showCodeInRunModeAtom } from "@/core/meta/state";
import { store } from "@/core/state/jotai";
import { useAsyncData } from "@/hooks/useAsyncData";
import { hasQueryParam } from "@/utils/urls";
import { KnownQueryParams } from "../constants";
import { getInitialAppMode } from "../mode";
import { PyodideBridge } from "./bridge";
import { hasAnyOutputAtom, wasmInitializationAtom } from "./state";
import { isWasm } from "./utils";

/**
 * HOC to load Pyodide before rendering children, if necessary.
 */
export const PyodideLoader: React.FC<PropsWithChildren> = ({ children }) => {
  if (!isWasm()) {
    return children;
  }

  return <PyodideLoaderInner>{children}</PyodideLoaderInner>;
};

const PyodideLoaderInner: React.FC<PropsWithChildren> = ({ children }) => {
  // isPyodide() is constant, so this is safe
  const { isPending, error } = useAsyncData(async () => {
    await PyodideBridge.INSTANCE.initialized.promise;
    return true;
  }, []);

  const hasOutput = useAtomValue(hasAnyOutputAtom);

  if (isPending) {
    return <WasmSpinner />;
  }

  // If ALL are true:
  // - are in read mode
  // - we are not showing the code
  // - and there is no output
  // then show the spinner
  if (!hasOutput && getInitialAppMode() === "read" && isCodeHidden()) {
    return <WasmSpinner />;
  }

  // Propagate back up to our error boundary
  if (error) {
    throw error;
  }

  return children;
};

function isCodeHidden() {
  // Code is hidden if ANY are true:
  // - the query param is set to false
  // - the view.showAppCode is false
  return (
    hasQueryParam(KnownQueryParams.showCode, "false") ||
    !store.get(showCodeInRunModeAtom)
  );
}

export const WasmSpinner: React.FC<PropsWithChildren> = ({ children }) => {
  const wasmInitialization = useAtomValue(wasmInitializationAtom);

  return <LargeSpinner title={wasmInitialization} />;
};
