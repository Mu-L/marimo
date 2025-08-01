/* Copyright 2024 Marimo. All rights reserved. */

import { history } from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { type EditorView, keymap, showPanel } from "@codemirror/view";
import type { CellId } from "@/core/cells/ids";
import type {
  CompletionConfig,
  DiagnosticsConfig,
  LSPConfig,
} from "@/core/config/config-schema";
import type { HotkeyProvider } from "@/core/hotkeys/hotkeys";
import { clamp } from "@/utils/math";
import {
  cellIdState,
  completionConfigState,
  hotkeysProviderState,
  lspConfigState,
  placeholderState,
} from "../config/extension";
import type { PlaceholderType } from "../config/types";
import { historyCompartment } from "../editing/extensions";
import { formattingChangeEffect } from "../format";
import { createPanel } from "../react-dom/createPanel";
import { getLanguageAdapters, LanguageAdapters } from "./LanguageAdapters";
import { initializeSQLDialect } from "./languages/sql";
import type { LanguageMetadata } from "./metadata";
import { languageMetadataField, setLanguageMetadata } from "./metadata";
import { LanguagePanelComponent } from "./panel/panel";
import type { LanguageAdapter } from "./types";
import { getEditorCodeAsPython } from "./utils";

/**
 * Compartment to keep track of the current language and extension.
 * When the language changes, the extensions inside the compartment will be updated.
 */
const languageCompartment = new Compartment();

/**
 * State effect to set the language adapter.
 */
export const setLanguageAdapter = StateEffect.define<LanguageAdapter>();

/**
 * State field to keep track of the current language adapter.
 */
export const languageAdapterState = StateField.define<LanguageAdapter>({
  create() {
    return LanguageAdapters.python;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setLanguageAdapter)) {
        return effect.value;
      }
    }
    return value;
  },
  // Only show the panel if the language is not python
  provide: (field) =>
    showPanel.from(field, (value) => {
      if (value.type === "python") {
        return null;
      }
      return (view) => createPanel(view, LanguagePanelComponent);
    }),
});

/**
 * Keymap to toggle between languages
 */
function languageToggleKeymaps() {
  const languages = getLanguageAdapters();
  // Cycle through the language to find the next one that supports the code
  const findNextLanguage = (code: string, index: number): LanguageAdapter => {
    const language = languages[index % languages.length];
    if (language.isSupported(code)) {
      return language;
    }
    return findNextLanguage(code, index + 1);
  };

  return [
    keymap.of([
      {
        key: "F4",
        preventDefault: true,
        run: (cm) => {
          // Find the next language
          const currentLanguage = cm.state.field(languageAdapterState);
          const currentLanguageIndex = languages.findIndex(
            (l) => l.type === currentLanguage.type,
          );
          const code = cm.state.doc.toString();
          const nextLanguage = findNextLanguage(code, currentLanguageIndex + 1);

          if (currentLanguage === nextLanguage) {
            return false;
          }

          updateLanguageAdapterAndCode({
            view: cm,
            nextLanguage,
            opts: {
              keepCodeAsIs: false,
            },
          });
          return true;
        },
      },
    ]),
  ];
}

function updateLanguageAdapterAndCode({
  view,
  nextLanguage,
  opts,
}: {
  view: EditorView;
  nextLanguage: LanguageAdapter;
  opts: { keepCodeAsIs: boolean };
}) {
  const currentLanguage = view.state.field(languageAdapterState);
  const code = view.state.doc.toString();
  const completionConfig = view.state.facet(completionConfigState);
  const hotkeysProvider = view.state.facet(hotkeysProviderState);
  const placeholderType = view.state.facet(placeholderState);
  const cellId = view.state.facet(cellIdState);
  const lspConfig = view.state.facet(lspConfigState);
  let metadata = view.state.field(languageMetadataField);
  let cursor = view.state.selection.main.head;

  // If keepCodeAsIs is true, we just keep the original code
  // but update the language.
  // If keepCodeAsIs is false, we need to transform the code
  // from the current language to the next language and update
  // the cursor position.
  let finalCode: string;
  if (opts.keepCodeAsIs) {
    finalCode = code;
    if (currentLanguage.type !== nextLanguage.type) {
      // Set the metadata to the default metadata
      metadata = { ...nextLanguage.defaultMetadata };
    }
  } else {
    const [codeOut, cursorDiff1] = currentLanguage.transformOut(code, metadata);
    const [newCode, cursorDiff2, metadataOut] =
      nextLanguage.transformIn(codeOut);
    // Update the cursor position
    cursor += cursorDiff1;
    cursor -= cursorDiff2;
    cursor = clamp(cursor, 0, newCode.length);
    finalCode = newCode;
    metadata = metadataOut as LanguageMetadata;
  }

  // Update the state
  view.dispatch({
    effects: [
      setLanguageAdapter.of(nextLanguage),
      setLanguageMetadata.of(metadata),
      languageCompartment.reconfigure(
        nextLanguage.getExtension(
          cellId,
          completionConfig,
          hotkeysProvider,
          placeholderType,
          lspConfig,
        ),
      ),
      // Clear history
      historyCompartment.reconfigure([]),
      // Let downstream extensions know that this is a formatting change
      formattingChangeEffect.of(true),
    ],
    changes: opts.keepCodeAsIs
      ? undefined
      : {
          from: 0,
          to: view.state.doc.length,
          insert: finalCode,
        },
    selection: opts.keepCodeAsIs ? undefined : EditorSelection.cursor(cursor),
  });

  // Add history back
  view.dispatch({
    effects: [historyCompartment.reconfigure([history()])],
  });

  // Initialize SQL dialect if switching to SQL
  if (nextLanguage.type === "sql") {
    initializeSQLDialect(view);
  }
}

/**
 * Set of extensions to enable adaptive language configuration.
 */
export function adaptiveLanguageConfiguration(opts: {
  placeholderType: PlaceholderType;
  completionConfig: CompletionConfig;
  hotkeys: HotkeyProvider;
  lspConfig: LSPConfig & { diagnostics?: DiagnosticsConfig };
  cellId: CellId;
}) {
  const { placeholderType, completionConfig, hotkeys, cellId, lspConfig } =
    opts;

  return [
    // Language adapter
    languageToggleKeymaps(),
    languageCompartment.of(
      LanguageAdapters.python.getExtension(
        cellId,
        completionConfig,
        hotkeys,
        placeholderType,
        lspConfig,
      ),
    ),
    languageAdapterState,
    languageMetadataField,
  ];
}

/**
 * Get the best language given the editors current code.
 */
export function getInitialLanguageAdapter(state: EditorView["state"]) {
  const doc = getEditorCodeAsPython({ state }).trim();
  return languageAdapterFromCode(doc);
}

/**
 * Get the best language adapter given the editor's current code.
 */
export function languageAdapterFromCode(doc: string): LanguageAdapter {
  // Empty doc defaults to Python
  if (!doc) {
    return LanguageAdapters.python;
  }

  if (LanguageAdapters.markdown.isSupported(doc)) {
    return LanguageAdapters.markdown;
  }
  if (LanguageAdapters.sql.isSupported(doc)) {
    return LanguageAdapters.sql;
  }

  return LanguageAdapters.python;
}

/**
 * Switch the language of the editor.
 *
 * @param view - The editor view.
 * @param language - The language to switch to.
 * @param opts.keepCodeAsIs - If true, we keep the original code but update the language.
 * If false, we transform the code from the current language to the next language and update
 * the cursor position.
 */
export function switchLanguage(
  view: EditorView,
  opts: {
    language: LanguageAdapter["type"];
    keepCodeAsIs?: boolean;
  },
) {
  // If the existing language is the same as the new language, do nothing
  const currentLanguage = view.state.field(languageAdapterState);
  if (currentLanguage.type === opts.language) {
    return;
  }

  updateLanguageAdapterAndCode({
    view,
    nextLanguage: LanguageAdapters[opts.language],
    opts: {
      keepCodeAsIs: opts.keepCodeAsIs ?? false,
    },
  });
}

/**
 * Reconfigure the editor view with
 * the new language extensions.
 *
 * This is used when the language changes
 * (e.g. switching from markdown to python).
 */
export function reconfigureLanguageEffect(
  view: EditorView,
  {
    completionConfig,
    hotkeysProvider,
    lspConfig,
  }: {
    completionConfig: CompletionConfig;
    hotkeysProvider: HotkeyProvider;
    lspConfig: LSPConfig & { diagnostics?: DiagnosticsConfig };
  },
) {
  const language = view.state.field(languageAdapterState);
  const placeholderType = view.state.facet(placeholderState);
  const cellId = view.state.facet(cellIdState);
  return languageCompartment.reconfigure(
    language.getExtension(
      cellId,
      completionConfig,
      hotkeysProvider,
      placeholderType,
      lspConfig,
    ),
  );
}
