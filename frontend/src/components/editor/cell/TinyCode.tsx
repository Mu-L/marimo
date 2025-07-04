/* Copyright 2024 Marimo. All rights reserved. */

import { python } from "@codemirror/lang-python";
import CodeMirror, { minimalSetup } from "@uiw/react-codemirror";
import React, { memo } from "react";

import "./TinyCode.css";
import { useTheme } from "@/theme/useTheme";
import { cn } from "@/utils/cn";

interface Props {
  code: string;
  className?: string;
}

const ext = [
  python(),
  minimalSetup({
    syntaxHighlighting: true,
    // Other options are false
    highlightSpecialChars: false,
    history: false,
    drawSelection: false,
    defaultKeymap: false,
    historyKeymap: false,
  }),
];

export const TinyCode: React.FC<Props> = memo(({ code, className }) => {
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        className,
        "text-muted-foreground flex flex-col overflow-hidden",
      )}
    >
      <CodeMirror
        minHeight="10px"
        theme={theme === "dark" ? "dark" : "light"}
        height="100%"
        className="tiny-code"
        editable={false}
        basicSetup={false}
        extensions={ext}
        value={code}
      />
    </div>
  );
});

TinyCode.displayName = "TinyCode";
