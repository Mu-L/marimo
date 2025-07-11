/* Copyright 2024 Marimo. All rights reserved. */

import { CommandList } from "cmdk";
import { BetweenHorizontalStartIcon, PlusIcon } from "lucide-react";
import React from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { readSnippets } from "@/core/network/requests";
import type { Snippet } from "@/core/network/types";
import { useAsyncData } from "@/hooks/useAsyncData";
import { renderHTML } from "@/plugins/core/RenderHTML";
import { ErrorBanner } from "@/plugins/impl/common/error-banner";
import { PanelEmptyState } from "./empty-state";

import "./snippets-panel.css";
import { EditorView } from "@codemirror/view";
import { Suspense } from "react";
import { Spinner } from "@/components/icons/spinner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useCellActions } from "@/core/cells/cells";
import { useLastFocusedCellId } from "@/core/cells/focus";
import { LazyAnyLanguageCodeMirror } from "@/plugins/impl/code/LazyAnyLanguageCodeMirror";
import { useTheme } from "@/theme/useTheme";
import { cn } from "@/utils/cn";
import { HideInKioskMode } from "../../kiosk-mode";
import { ContributeSnippetButton } from "../components/contribute-snippet-button";

const extensions = [EditorView.lineWrapping];

export const SnippetsPanel: React.FC = () => {
  const [selectedSnippet, setSelectedSnippet] = React.useState<Snippet>();
  const {
    data: snippets,
    error,
    isPending,
  } = useAsyncData(() => {
    return readSnippets();
  }, []);

  if (error) {
    return <ErrorBanner error={error} />;
  }

  if (isPending || !snippets) {
    return <Spinner size="medium" centered={true} />;
  }

  return (
    <div className="flex-1 overflow-hidden">
      <Command
        className={cn(
          "border-b rounded-none",
          selectedSnippet ? "h-1/3" : "h-full",
        )}
      >
        <div className="flex items-center w-full">
          <CommandInput
            placeholder="Search snippets..."
            className="h-6 m-1"
            rootClassName="flex-1 border-r"
          />
          <ContributeSnippetButton>
            <button className="float-right border-b px-2 m-0 h-full hover:bg-accent hover:text-accent-foreground">
              <PlusIcon className="h-4 w-4" />
            </button>
          </ContributeSnippetButton>
        </div>

        <CommandEmpty>No results</CommandEmpty>
        <SnippetList
          onSelect={(snippet) => setSelectedSnippet(snippet)}
          snippets={snippets.snippets}
        />
      </Command>
      <Suspense>
        <div className="h-2/3 snippet-viewer flex flex-col">
          {selectedSnippet ? (
            <SnippetViewer
              key={selectedSnippet.title}
              snippet={selectedSnippet}
            />
          ) : (
            <PanelEmptyState
              title=""
              description="Click on a snippet to view its content."
            />
          )}
        </div>
      </Suspense>
    </div>
  );
};

const SnippetViewer: React.FC<{ snippet: Snippet }> = ({ snippet }) => {
  const { theme } = useTheme();
  const { createNewCell } = useCellActions();
  const lastFocusedCellId = useLastFocusedCellId();

  const handleInsertSnippet = () => {
    // Add below last focused cell in reverse order
    for (const section of [...snippet.sections].reverse()) {
      if (section.code) {
        createNewCell({
          code: section.code,
          before: false,
          cellId: lastFocusedCellId ?? "__end__",
          // If the code already exists, skip creation
          skipIfCodeExists: true,
        });
      }
    }
  };

  const handleInsertCode = (code: string) => {
    createNewCell({
      code,
      before: false,
      cellId: lastFocusedCellId ?? "__end__",
    });
  };

  return (
    <>
      <div className="text-sm font-semibold bg-muted border-y px-2 py-1">
        {snippet.title}
      </div>
      <div className="px-2 py-2 space-y-4 overflow-auto flex-1">
        <div className="flex justify-end">
          <HideInKioskMode>
            <Button
              className="float-right"
              size="xs"
              variant="outline"
              onClick={handleInsertSnippet}
            >
              Insert snippet
              <BetweenHorizontalStartIcon className="ml-2 h-4 w-4" />
            </Button>
          </HideInKioskMode>
        </div>
        {snippet.sections.map((section) => {
          const { code, html, id } = section;
          if (html) {
            return (
              <div key={`${snippet.title}-${id}`}>
                {renderHTML({ html: html })}
              </div>
            );
          }

          if (!code) {
            return null;
          }

          return (
            <div
              className="relative hover-actions-parent pr-2"
              key={`${snippet.title}-${id}`}
            >
              <HideInKioskMode>
                <Tooltip content="Insert snippet">
                  <Button
                    className="absolute -top-2 -right-1 z-10 hover-action px-2 bg-background"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleInsertCode(code);
                    }}
                  >
                    <BetweenHorizontalStartIcon className="h-5 w-5" />
                  </Button>
                </Tooltip>
              </HideInKioskMode>
              <Suspense>
                <LazyAnyLanguageCodeMirror
                  key={`${snippet.title}-${id}`}
                  theme={theme === "dark" ? "dark" : "light"}
                  language="python"
                  className="cm border rounded overflow-hidden"
                  extensions={extensions}
                  value={code}
                  readOnly={true}
                />
              </Suspense>
            </div>
          );
        })}
      </div>
    </>
  );
};

const SnippetList: React.FC<{
  onSelect: (snippet: Snippet) => void;
  snippets: Snippet[];
}> = ({ snippets, onSelect }) => {
  return (
    <CommandList className="flex flex-col overflow-auto">
      {snippets.map((snippet) => (
        <CommandItem
          className="rounded-none"
          key={snippet.title}
          onSelect={() => onSelect(snippet)}
        >
          <div className="flex flex-row gap-2 items-center">
            <span className="mt-1 text-accent-foreground">{snippet.title}</span>
          </div>
        </CommandItem>
      ))}
    </CommandList>
  );
};
