/* Copyright 2024 Marimo. All rights reserved. */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { startCase } from "lodash-es";
import {
  BookMarkedIcon,
  CheckIcon,
  ChevronDownCircleIcon,
  ChevronRightCircleIcon,
  ClipboardCopyIcon,
  CodeIcon,
  CommandIcon,
  DatabaseIcon,
  DiamondPlusIcon,
  DownloadIcon,
  EditIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  FastForwardIcon,
  FileIcon,
  FilePlus2Icon,
  Files,
  FileTextIcon,
  FolderDownIcon,
  GithubIcon,
  GlobeIcon,
  Home,
  ImageIcon,
  KeyboardIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessagesSquareIcon,
  PanelLeftIcon,
  PowerSquareIcon,
  PresentationIcon,
  SettingsIcon,
  Share2Icon,
  Undo2Icon,
  XCircleIcon,
  YoutubeIcon,
  ZapIcon,
  ZapOffIcon,
} from "lucide-react";
import { settingDialogAtom } from "@/components/app-config/state";
import { MarkdownIcon } from "@/components/editor/cell/code/icons";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { renderShortcut } from "@/components/shortcuts/renderShortcut";
import { ShareStaticNotebookModal } from "@/components/static-html/share-modal";
import { toast } from "@/components/ui/use-toast";
import {
  canUndoDeletesAtom,
  getNotebook,
  hasDisabledCellsAtom,
  hasEnabledCellsAtom,
  useCellActions,
} from "@/core/cells/cells";
import { disabledCellIds, enabledCellIds } from "@/core/cells/utils";
import { useResolvedMarimoConfig } from "@/core/config/config";
import { Constants } from "@/core/constants";
import { useLayoutActions, useLayoutState } from "@/core/layout/layout";
import { useTogglePresenting } from "@/core/layout/useTogglePresenting";
import { kioskModeAtom, viewStateAtom } from "@/core/mode";
import {
  exportAsMarkdown,
  readCode,
  saveCellConfig,
} from "@/core/network/requests";
import { useFilename } from "@/core/saving/filename";
import { downloadAsHTML } from "@/core/static/download-html";
import { createShareableLink } from "@/core/wasm/share";
import { isWasm } from "@/core/wasm/utils";
import { copyToClipboard } from "@/utils/copy";
import { downloadBlob, downloadHTMLAsImage } from "@/utils/download";
import { Filenames } from "@/utils/filenames";
import { Objects } from "@/utils/objects";
import { newNotebookURL } from "@/utils/urls";
import { useRunAllCells } from "../cell/useRunCells";
import { useChromeActions, useChromeState } from "../chrome/state";
import { PANELS } from "../chrome/types";
import { commandPaletteAtom } from "../controls/command-palette";
import { keyboardShortcutsAtom } from "../controls/keyboard-shortcuts";
import { AddDatabaseDialogContent } from "../database/add-database-form";
import { displayLayoutName, getLayoutIcon } from "../renderers/layout-select";
import { LAYOUT_TYPES } from "../renderers/types";
import type { ActionButton } from "./types";
import { useCopyNotebook } from "./useCopyNotebook";
import { useHideAllMarkdownCode } from "./useHideAllMarkdownCode";
import { useRestartKernel } from "./useRestartKernel";

const NOOP_HANDLER = (event?: Event) => {
  event?.preventDefault();
  event?.stopPropagation();
};

export function useNotebookActions() {
  const filename = useFilename();
  const { openModal, closeModal } = useImperativeModal();
  const { toggleApplication } = useChromeActions();
  const { selectedPanel } = useChromeState();
  const [viewState] = useAtom(viewStateAtom);
  const kioskMode = useAtomValue(kioskModeAtom);
  const hideAllMarkdownCode = useHideAllMarkdownCode();
  const [resolvedConfig] = useResolvedMarimoConfig();

  const {
    updateCellConfig,
    undoDeleteCell,
    clearAllCellOutputs,
    upsertSetupCell,
    collapseAllCells,
    expandAllCells,
  } = useCellActions();
  const restartKernel = useRestartKernel();
  const runAllCells = useRunAllCells();
  const copyNotebook = useCopyNotebook(filename);
  const setCommandPaletteOpen = useSetAtom(commandPaletteAtom);
  const setSettingsDialogOpen = useSetAtom(settingDialogAtom);
  const setKeyboardShortcutsOpen = useSetAtom(keyboardShortcutsAtom);

  const hasDisabledCells = useAtomValue(hasDisabledCellsAtom);
  const hasEnabledCells = useAtomValue(hasEnabledCellsAtom);
  const canUndoDeletes = useAtomValue(canUndoDeletesAtom);
  const { selectedLayout } = useLayoutState();
  const { setLayoutView } = useLayoutActions();
  const togglePresenting = useTogglePresenting();

  // Fallback: if sharing is undefined, both are enabled by default
  const sharingHtmlEnabled = resolvedConfig.sharing?.html ?? true;
  const sharingWasmEnabled = resolvedConfig.sharing?.wasm ?? true;

  const renderCheckboxElement = (checked: boolean) => (
    <div className="w-8 flex justify-end">
      {checked && <CheckIcon size={14} />}
    </div>
  );

  const actions: ActionButton[] = [
    {
      icon: <Share2Icon size={14} strokeWidth={1.5} />,
      label: "Share",
      handle: NOOP_HANDLER,
      hidden: !sharingHtmlEnabled && !sharingWasmEnabled,
      dropdown: [
        {
          icon: <GlobeIcon size={14} strokeWidth={1.5} />,
          label: "Publish HTML to web",
          hidden: !sharingHtmlEnabled,
          handle: async () => {
            openModal(<ShareStaticNotebookModal onClose={closeModal} />);
          },
        },
        {
          icon: <LinkIcon size={14} strokeWidth={1.5} />,
          label: "Create WebAssembly link",
          hidden: !sharingWasmEnabled,
          handle: async () => {
            const code = await readCode();
            const url = createShareableLink({ code: code.contents });
            await copyToClipboard(url);
            toast({
              title: "Copied",
              description: "Link copied to clipboard.",
            });
          },
        },
      ],
    },
    {
      icon: <DownloadIcon size={14} strokeWidth={1.5} />,
      label: "Download",
      handle: NOOP_HANDLER,
      dropdown: [
        {
          icon: <FolderDownIcon size={14} strokeWidth={1.5} />,
          label: "Download as HTML",
          handle: async () => {
            if (!filename) {
              toast({
                variant: "danger",
                title: "Error",
                description: "Notebooks must be named to be exported.",
              });
              return;
            }
            await downloadAsHTML({ filename, includeCode: true });
          },
        },
        {
          icon: <FolderDownIcon size={14} strokeWidth={1.5} />,
          label: "Download as HTML (exclude code)",
          handle: async () => {
            if (!filename) {
              toast({
                variant: "danger",
                title: "Error",
                description: "Notebooks must be named to be exported.",
              });
              return;
            }
            await downloadAsHTML({ filename, includeCode: false });
          },
        },
        {
          icon: (
            <MarkdownIcon strokeWidth={1.5} style={{ width: 14, height: 14 }} />
          ),
          label: "Download as Markdown",
          handle: async () => {
            const md = await exportAsMarkdown({ download: false });
            downloadBlob(
              new Blob([md], { type: "text/plain" }),
              Filenames.toMarkdown(document.title),
            );
          },
        },
        {
          icon: <CodeIcon size={14} strokeWidth={1.5} />,
          label: "Download Python code",
          handle: async () => {
            const code = await readCode();
            downloadBlob(
              new Blob([code.contents], { type: "text/plain" }),
              Filenames.toPY(document.title),
            );
          },
        },
        {
          divider: true,
          icon: <ImageIcon size={14} strokeWidth={1.5} />,
          label: "Download as PNG",
          disabled: viewState.mode !== "present",
          tooltip:
            viewState.mode === "present" ? undefined : (
              <span>
                Only available in app view. <br />
                Toggle with: {renderShortcut("global.hideCode", false)}
              </span>
            ),
          handle: async () => {
            const app = document.getElementById("App");
            if (!app) {
              return;
            }
            await downloadHTMLAsImage(app, document.title);
          },
        },
        {
          icon: <FileIcon size={14} strokeWidth={1.5} />,
          label: "Download as PDF",
          disabled: viewState.mode !== "present",
          tooltip:
            viewState.mode === "present" ? undefined : (
              <span>
                Only available in app view. <br />
                Toggle with: {renderShortcut("global.hideCode", false)}
              </span>
            ),
          handle: async () => {
            const beforeprint = new Event("export-beforeprint");
            const afterprint = new Event("export-afterprint");
            function print() {
              window.dispatchEvent(beforeprint);
              setTimeout(() => window.print(), 0);
              setTimeout(() => window.dispatchEvent(afterprint), 0);
            }
            print();
          },
        },
      ],
    },

    {
      divider: true,
      icon: <PanelLeftIcon size={14} strokeWidth={1.5} />,
      label: "Helper panel",
      handle: NOOP_HANDLER,
      dropdown: PANELS.flatMap(({ type, Icon, hidden }) => {
        if (hidden) {
          return [];
        }
        return {
          label: startCase(type),
          rightElement: renderCheckboxElement(selectedPanel === type),
          icon: <Icon size={14} strokeWidth={1.5} />,
          handle: () => toggleApplication(type),
        };
      }),
    },

    {
      icon: <PresentationIcon size={14} strokeWidth={1.5} />,
      label: "Present as",
      handle: NOOP_HANDLER,
      dropdown: [
        {
          icon:
            viewState.mode === "present" ? (
              <EditIcon size={14} strokeWidth={1.5} />
            ) : (
              <LayoutTemplateIcon size={14} strokeWidth={1.5} />
            ),
          label: "Toggle app view",
          hotkey: "global.hideCode",
          handle: () => {
            togglePresenting();
          },
        },
        ...LAYOUT_TYPES.map((type, idx) => {
          const Icon = getLayoutIcon(type);
          return {
            divider: idx === 0,
            label: displayLayoutName(type),
            icon: <Icon size={14} strokeWidth={1.5} />,
            rightElement: (
              <div className="w-8 flex justify-end">
                {selectedLayout === type && <CheckIcon size={14} />}
              </div>
            ),
            handle: () => {
              setLayoutView(type);
              // Toggle if it's not in present mode
              if (viewState.mode === "edit") {
                togglePresenting();
              }
            },
          };
        }),
      ],
    },

    {
      icon: <Files size={14} strokeWidth={1.5} />,
      label: "Create notebook copy",
      hidden: !filename || isWasm(),
      handle: copyNotebook,
    },
    {
      icon: <ClipboardCopyIcon size={14} strokeWidth={1.5} />,
      label: "Copy code to clipboard",
      hidden: !filename,
      handle: async () => {
        const code = await readCode();
        await copyToClipboard(code.contents);
        toast({
          title: "Copied",
          description: "Code copied to clipboard.",
        });
      },
    },
    {
      icon: <ZapIcon size={14} strokeWidth={1.5} />,
      label: "Enable all cells",
      hidden: !hasDisabledCells || kioskMode,
      handle: async () => {
        const notebook = getNotebook();
        const ids = disabledCellIds(notebook);
        const newConfigs = Objects.fromEntries(
          ids.map((cellId) => [cellId, { disabled: false }]),
        );
        // send to BE
        await saveCellConfig({ configs: newConfigs });
        // update on FE
        for (const cellId of ids) {
          updateCellConfig({ cellId, config: { disabled: false } });
        }
      },
    },
    {
      icon: <ZapOffIcon size={14} strokeWidth={1.5} />,
      label: "Disable all cells",
      hidden: !hasEnabledCells || kioskMode,
      handle: async () => {
        const notebook = getNotebook();
        const ids = enabledCellIds(notebook);
        const newConfigs = Objects.fromEntries(
          ids.map((cellId) => [cellId, { disabled: true }]),
        );
        // send to BE
        await saveCellConfig({ configs: newConfigs });
        // update on FE
        for (const cellId of ids) {
          updateCellConfig({ cellId, config: { disabled: true } });
        }
      },
    },
    {
      icon: <EyeOffIcon size={14} strokeWidth={1.5} />,
      label: "Hide all markdown code",
      handle: hideAllMarkdownCode,
    },
    {
      icon: <ChevronRightCircleIcon size={14} strokeWidth={1.5} />,
      label: "Collapse all sections",
      hotkey: "global.collapseAllSections",
      handle: collapseAllCells,
    },
    {
      icon: <ChevronDownCircleIcon size={14} strokeWidth={1.5} />,
      label: "Expand all sections",
      hotkey: "global.expandAllSections",
      handle: expandAllCells,
    },
    {
      icon: <DiamondPlusIcon size={14} strokeWidth={1.5} />,
      label: "Add setup cell",
      handle: () => {
        upsertSetupCell({
          code: "# Initialization code that runs before all other cells",
        });
      },
    },
    {
      icon: <XCircleIcon size={14} strokeWidth={1.5} />,
      label: "Clear all outputs",
      handle: () => {
        clearAllCellOutputs();
      },
    },
    {
      icon: <FastForwardIcon size={14} strokeWidth={1.5} />,
      label: "Re-run all cells",
      hotkey: "global.runAll",
      handle: async () => {
        runAllCells();
      },
    },
    {
      icon: <Undo2Icon size={14} strokeWidth={1.5} />,
      label: "Undo cell deletion",
      hidden: !canUndoDeletes || kioskMode,
      handle: () => {
        undoDeleteCell();
      },
    },
    {
      icon: <DatabaseIcon size={14} strokeWidth={1.5} />,
      label: "Add database connection",
      handle: () => {
        openModal(<AddDatabaseDialogContent onClose={closeModal} />);
      },
    },

    {
      divider: true,
      icon: <CommandIcon size={14} strokeWidth={1.5} />,
      label: "Command palette",
      hotkey: "global.commandPalette",
      handle: () => setCommandPaletteOpen((open) => !open),
    },

    {
      icon: <SettingsIcon size={14} strokeWidth={1.5} />,
      label: "User settings",
      handle: () => setSettingsDialogOpen((open) => !open),
    },

    {
      icon: <KeyboardIcon size={14} strokeWidth={1.5} />,
      label: "Keyboard shortcuts",
      hotkey: "global.showHelp",
      handle: () => setKeyboardShortcutsOpen((open) => !open),
    },

    {
      icon: <BookMarkedIcon size={14} strokeWidth={1.5} />,
      label: "Open documentation",
      handle: () => {
        window.open(Constants.docsPage, "_blank");
      },
    },

    {
      icon: <ExternalLinkIcon size={14} strokeWidth={1.5} />,
      label: "Resources",
      handle: NOOP_HANDLER,
      dropdown: [
        {
          icon: <BookMarkedIcon size={14} strokeWidth={1.5} />,
          label: "Documentation",
          handle: () => {
            window.open(Constants.docsPage, "_blank");
          },
        },
        {
          icon: <GithubIcon size={14} strokeWidth={1.5} />,
          label: "GitHub",
          handle: () => {
            window.open(Constants.githubPage, "_blank");
          },
        },
        {
          icon: <MessagesSquareIcon size={14} strokeWidth={1.5} />,
          label: "Discord Community",
          handle: () => {
            window.open(Constants.discordLink, "_blank");
          },
        },
        {
          icon: <YoutubeIcon size={14} strokeWidth={1.5} />,
          label: "YouTube",
          handle: () => {
            window.open(Constants.youtube, "_blank");
          },
        },
        {
          icon: <FileTextIcon size={14} strokeWidth={1.5} />,
          label: "Changelog",
          handle: () => {
            window.open(Constants.releasesPage, "_blank");
          },
        },
      ],
    },

    {
      divider: true,
      icon: <Home size={14} strokeWidth={1.5} />,
      label: "Return home",
      // If file is in the url, then we ran `marimo edit`
      // without a specific file
      hidden: !location.search.includes("file"),
      handle: () => {
        const withoutSearch = document.baseURI.split("?")[0];
        window.open(withoutSearch, "_self");
      },
    },

    {
      icon: <FilePlus2Icon size={14} strokeWidth={1.5} />,
      label: "New notebook",
      // If file is in the url, then we ran `marimo edit`
      // without a specific file
      hidden: !location.search.includes("file"),
      handle: () => {
        const url = newNotebookURL();
        window.open(url, "_blank");
      },
    },

    {
      icon: <PowerSquareIcon size={14} strokeWidth={1.5} />,
      label: "Restart kernel",
      variant: "danger",
      handle: restartKernel,
    },
  ];

  return actions
    .filter((a) => !a.hidden)
    .map((action) => {
      if (action.dropdown) {
        return {
          ...action,
          dropdown: action.dropdown.filter((item) => !item.hidden),
        };
      }
      return action;
    });
}
