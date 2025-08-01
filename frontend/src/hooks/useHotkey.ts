/* Copyright 2024 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { type RefObject, useEffect } from "react";
import { hotkeysAtom } from "@/core/config/config";
import type { HotkeyAction } from "@/core/hotkeys/hotkeys";
import { Functions } from "@/utils/functions";
import { Logger } from "@/utils/Logger";
import { Objects } from "@/utils/objects";
import { useSetRegisteredAction } from "../core/hotkeys/actions";
import { parseShortcut } from "../core/hotkeys/shortcuts";
import { useEvent } from "./useEvent";
import { useEventListener } from "./useEventListener";

type HotkeyHandler = (
  evt?: KeyboardEvent,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) => boolean | void | undefined | Promise<void>;

/**
 * Registers a hotkey listener for the given shortcut.
 *
 * @param callback The callback to run when the shortcut is pressed. It does not need to be memoized as this hook will always use the latest callback.
 * If the callback returns false, preventDefault will not be called on the event.
 */
export function useHotkey(shortcut: HotkeyAction, callback: HotkeyHandler) {
  const { registerAction, unregisterAction } = useSetRegisteredAction();
  const hotkeys = useAtomValue(hotkeysAtom);

  const isNOOP = callback === Functions.NOOP;
  const memoizeCallback = useEvent((evt?: KeyboardEvent) => callback(evt));

  const listener = useEvent((e: KeyboardEvent) => {
    const key = hotkeys.getHotkey(shortcut).key;
    if (parseShortcut(key)(e)) {
      const response = callback(e);
      // Prevent default if the callback does not return false
      if (response !== false) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  });

  // Register keydown listener
  useEventListener(document, "keydown", listener);

  // Register with the shortcut registry
  useEffect(() => {
    if (!isNOOP) {
      registerAction(shortcut, memoizeCallback);
      return () => unregisterAction(shortcut);
    }
  }, [memoizeCallback, shortcut, isNOOP, registerAction, unregisterAction]);
}

/**
 * Registers a hotkey listener on a given element or ref to an element.
 */
export function useKeydownOnElement(
  element: RefObject<HTMLElement | null> | null,
  handlers: Record<string, HotkeyHandler>,
) {
  useEventListener(element, "keydown", (e) => {
    for (const [key, callback] of Objects.entries(handlers)) {
      if (parseShortcut(key)(e)) {
        Logger.debug("Satisfied", key, e);
        const response = callback(e);
        // Prevent default if the callback does not return false
        if (response !== false) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  });
}
