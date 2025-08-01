/* Copyright 2024 Marimo. All rights reserved. */

import type {
  Column,
  OnChangeFn,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  SearchIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { ColumnName } from "@/components/datasources/components";
import { CopyClipboardIcon } from "@/components/icons/copy-icon";
import { KeyboardHotkeys } from "@/components/shortcuts/renderShortcut";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useKeydownOnElement } from "@/hooks/useHotkey";
import { Banner, ErrorBanner } from "@/plugins/impl/common/error-banner";
import type { GetRowResult } from "@/plugins/impl/DataTablePlugin";
import { NAMELESS_COLUMN_PREFIX, renderCellValue } from "../columns";
import { prettifyRowCount } from "../pagination";
import {
  type FieldTypesWithExternalType,
  INDEX_COLUMN_NAME,
  SELECT_COLUMN_ID,
  TOO_MANY_ROWS,
  type TooManyRows,
} from "../types";

export interface RowViewerPanelProps {
  rowIdx: number;
  setRowIdx: (rowIdx: number) => void;
  totalRows: number | TooManyRows;
  fieldTypes: FieldTypesWithExternalType | undefined | null;
  getRow: (rowIdx: number) => Promise<GetRowResult>;
  isSelectable: boolean;
  isRowSelected: boolean;
  handleRowSelectionChange?: OnChangeFn<RowSelectionState>;
}

export const RowViewerPanel: React.FC<RowViewerPanelProps> = ({
  rowIdx,
  setRowIdx,
  totalRows,
  fieldTypes,
  getRow,
  isSelectable,
  isRowSelected,
  handleRowSelectionChange,
}: RowViewerPanelProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const tooManyRows = totalRows === TOO_MANY_ROWS;

  const { data: rows, error } = useAsyncData(async () => {
    const data = await getRow(rowIdx);
    return data.rows;
  }, [getRow, rowIdx, totalRows]);

  const setRow = (rowIdx: number) => {
    if (rowIdx < 0 || (typeof totalRows === "number" && rowIdx >= totalRows)) {
      return;
    }
    setRowIdx(rowIdx);
  };

  const toggleRowSelection = () => {
    handleRowSelectionChange?.((prev) => {
      if (isRowSelected) {
        // Remove this row from selection
        const { [rowIdx]: removedRow, ...rest } = prev;
        return rest;
      }
      // Add this row to selection
      return { ...prev, [rowIdx]: true };
    });
  };

  // Total rows may change after the row viewer panel is opened
  if (!tooManyRows && rowIdx > totalRows) {
    setRow(totalRows - 1);
  }

  useKeydownOnElement(panelRef, {
    ArrowLeft: (e) => {
      if (e?.target === searchInputRef.current) {
        return false;
      }
      setRow(rowIdx - 1);
    },
    ArrowRight: (e) => {
      if (e?.target === searchInputRef.current) {
        return false;
      }
      setRow(rowIdx + 1);
    },
    Space: (e) => {
      if (e?.target === searchInputRef.current) {
        return false;
      }
      toggleRowSelection();
    },
  });

  const buttonStyles = "h-6 w-6 p-0.5";

  const renderTable = () => {
    if (error) {
      return <ErrorBanner error={error} className="p-4 mx-3 mt-5" />;
    }

    if (totalRows === 0) {
      return (
        <SimpleBanner kind="info" Icon={Info} message="No rows selected" />
      );
    }

    if (!rows) {
      return (
        <SimpleBanner
          kind="warn"
          Icon={AlertTriangle}
          message="No data available. Please report the issue."
        />
      );
    }

    if (rows.length !== 1) {
      return (
        <SimpleBanner
          kind="warn"
          Icon={AlertTriangle}
          message={`Expected 1 row, got ${rows.length} rows. Please report the issue.`}
        />
      );
    }

    const currentRow = rows[0];
    if (typeof currentRow !== "object" || currentRow === null) {
      return (
        <SimpleBanner
          kind="warn"
          Icon={AlertTriangle}
          message="Row is not an object. Please report the issue."
        />
      );
    }

    const rowValues: Record<string, unknown> = {};
    for (const [columnName, columnValue] of Object.entries(currentRow)) {
      if (columnName === SELECT_COLUMN_ID || columnName === INDEX_COLUMN_NAME) {
        continue;
      }
      if (columnName.startsWith(NAMELESS_COLUMN_PREFIX)) {
        // Remove the prefix
        rowValues[columnName.slice(NAMELESS_COLUMN_PREFIX.length)] =
          columnValue;
      } else {
        rowValues[columnName] = columnValue;
      }
    }

    return (
      <Table className="mb-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">Column</TableHead>
            <TableHead className="w-3/4">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fieldTypes?.map(([columnName, [dataType, externalType]]) => {
            const columnValue = rowValues[columnName];

            if (!inSearchQuery({ columnName, columnValue, searchQuery })) {
              return null;
            }

            const mockColumn = {
              id: columnName,
              columnDef: {
                meta: {
                  dataType,
                },
              },
              getColumnFormatting: () => undefined,
              applyColumnFormatting: (value) => value,
            } as Column<unknown>;

            const cellContent = renderCellValue(
              mockColumn,
              () => columnValue,
              () => columnValue,
              undefined,
              "text-left break-word",
            );

            const copyValue =
              typeof columnValue === "object"
                ? JSON.stringify(columnValue)
                : String(columnValue);

            return (
              <TableRow key={columnName} className="group">
                <TableCell>
                  <ColumnName
                    columnName={<span>{columnName}</span>}
                    dataType={dataType}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-row items-center justify-between gap-1">
                    {cellContent}
                    <CopyClipboardIcon
                      value={copyValue}
                      className="w-3 h-3 mr-1 text-muted-foreground cursor-pointer opacity-0 group-hover:opacity-100"
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div
      className="flex flex-col gap-3 mt-4 focus:outline-none"
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex flex-row gap-2 items-center mr-2">
        {isSelectable && (
          <div className="flex flex-row gap-1 items-center">
            <Button
              variant="link"
              size="xs"
              className="pr-0"
              onClick={toggleRowSelection}
            >
              {isRowSelected ? "Deselect row" : "Select row"}
            </Button>
            <KeyboardHotkeys shortcut="Space" />
          </div>
        )}

        <Button
          variant="outline"
          size="xs"
          className={`${buttonStyles} ml-auto`}
          onClick={() => setRow(0)}
          disabled={rowIdx === 0}
          aria-label="Go to first row"
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="xs"
          className={buttonStyles}
          onClick={() => setRow(rowIdx - 1)}
          disabled={rowIdx === 0}
          aria-label="Previous row"
        >
          <ChevronLeft />
        </Button>
        <span className="text-xs">
          {tooManyRows
            ? `Row ${rowIdx + 1}`
            : `Row ${rowIdx + 1} of ${prettifyRowCount(totalRows)}`}
        </span>
        <Button
          variant="outline"
          size="xs"
          className={buttonStyles}
          onClick={() => setRow(rowIdx + 1)}
          disabled={!tooManyRows && rowIdx === totalRows - 1}
          aria-label="Next row"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="xs"
          className={buttonStyles}
          onClick={() => {
            if (!tooManyRows) {
              setRow(totalRows - 1);
            }
          }}
          disabled={tooManyRows || rowIdx === totalRows - 1}
          aria-label="Go to last row"
        >
          <ChevronsRight />
        </Button>
      </div>

      <div className="mx-2 -mb-1">
        <Input
          ref={searchInputRef}
          type="text"
          placeholder="Search"
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<SearchIcon className="w-4 h-4" />}
          className="mb-0 border-border"
          data-testid="selection-panel-search-input"
        />
      </div>
      {renderTable()}
    </div>
  );
};

export function inSearchQuery({
  columnName,
  columnValue,
  searchQuery,
}: {
  columnName: string;
  columnValue: unknown;
  searchQuery: string;
}) {
  const colName = columnName.toLowerCase();
  const searchQueryLower = searchQuery.toLowerCase();

  let columnValueString =
    typeof columnValue === "object"
      ? JSON.stringify(columnValue)
      : String(columnValue);
  columnValueString = columnValueString.toLowerCase();

  return (
    colName.includes(searchQueryLower) ||
    columnValueString.includes(searchQueryLower)
  );
}

const SimpleBanner: React.FC<{
  kind: "info" | "warn" | "danger";
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  message: string;
}> = ({ kind, Icon, message }) => {
  return (
    <Banner
      kind={kind}
      className="p-4 mx-3 mt-3 flex flex-row items-center gap-2"
    >
      <Icon className="w-5 h-5" />
      <span>{message}</span>
    </Banner>
  );
};
