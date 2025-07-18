/* Copyright 2024 Marimo. All rights reserved. */
"use no memo";

import {
  type Cell,
  type Column,
  type ColumnDef,
  flexRender,
  type HeaderGroup,
  type Row,
  type Table,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import { type JSX, useRef } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/utils/cn";
import { CellRangeSelectionIndicator } from "./range-focus/cell-selection-indicator";
import { useCellRangeSelection } from "./range-focus/use-cell-range-selection";
import { useScrollIntoViewOnFocus } from "./range-focus/use-scroll-into-view";

export function renderTableHeader<TData>(
  table: Table<TData>,
): JSX.Element | null {
  if (!table.getRowModel().rows?.length) {
    return null;
  }

  const renderHeaderGroup = (headerGroups: Array<HeaderGroup<TData>>) => {
    return headerGroups.map((headerGroup) =>
      headerGroup.headers.map((header) => {
        const { className, style } = getPinningStyles(header.column);
        return (
          <TableHead
            key={header.id}
            className={cn(
              "h-auto min-h-10 whitespace-pre align-top",
              className,
            )}
            style={style}
            ref={(thead) => {
              columnSizingHandler(thead, table, header.column);
            }}
          >
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())}
          </TableHead>
        );
      }),
    );
  };

  return (
    <TableHeader>
      <TableRow>
        {renderHeaderGroup(table.getLeftHeaderGroups())}
        {renderHeaderGroup(table.getCenterHeaderGroups())}
        {renderHeaderGroup(table.getRightHeaderGroups())}
      </TableRow>
    </TableHeader>
  );
}

interface DataTableBodyProps<TData> {
  table: Table<TData>;
  columns: Array<ColumnDef<TData>>;
  rowViewerPanelOpen: boolean;
  getRowIndex?: (row: TData, idx: number) => number;
  viewedRowIdx?: number;
}

export const DataTableBody = <TData,>({
  table,
  columns,
  rowViewerPanelOpen,
  getRowIndex,
  viewedRowIdx,
}: DataTableBodyProps<TData>) => {
  // Automatically scroll focused cells into view
  const tableRef = useRef<HTMLTableSectionElement>(null);
  useScrollIntoViewOnFocus(tableRef);

  const {
    handleCellMouseDown,
    handleCellMouseUp,
    handleCellMouseOver,
    handleCellsKeyDown,
  } = useCellRangeSelection({ table });

  const renderCells = (cells: Array<Cell<TData, unknown>>) => {
    return cells.map((cell) => {
      const { className, style: pinningstyle } = getPinningStyles(cell.column);
      const style = Object.assign(
        {},
        cell.getUserStyling?.() || {},
        pinningstyle,
      );
      return (
        <TableCell
          tabIndex={0}
          key={cell.id}
          className={cn(
            "whitespace-pre truncate max-w-[300px] outline-none",
            cell.column.getColumnWrapping &&
              cell.column.getColumnWrapping() === "wrap" &&
              "whitespace-pre-wrap min-w-[200px]",
            "px-1.5 py-[0.18rem]",
            className,
          )}
          style={style}
          onMouseDown={(e) => handleCellMouseDown(e, cell)}
          onMouseUp={handleCellMouseUp}
          onMouseOver={(e) => handleCellMouseOver(e, cell)}
        >
          <CellRangeSelectionIndicator cellId={cell.id} />
          <div className="relative">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        </TableCell>
      );
    });
  };

  const handleRowClick = (row: Row<TData>) => {
    if (rowViewerPanelOpen) {
      const rowIndex = getRowIndex?.(row.original, row.index) ?? row.index;
      row.focusRow?.(rowIndex);
    }
  };

  return (
    <TableBody onKeyDown={handleCellsKeyDown} ref={tableRef}>
      {table.getRowModel().rows?.length ? (
        table.getRowModel().rows.map((row) => {
          // Only find the row index if the row viewer panel is open
          const rowIndex = rowViewerPanelOpen
            ? (getRowIndex?.(row.original, row.index) ?? row.index)
            : undefined;
          const isRowViewedInPanel =
            rowViewerPanelOpen && viewedRowIdx === rowIndex;

          return (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              // These classes ensure that empty rows (nulls) still render
              className={cn(
                "border-t h-6",
                rowViewerPanelOpen && "cursor-pointer",
                isRowViewedInPanel &&
                  "bg-[var(--blue-3)] hover:bg-[var(--blue-3)] data-[state=selected]:bg-[var(--blue-4)]",
              )}
              onClick={() => handleRowClick(row)}
            >
              {renderCells(row.getLeftVisibleCells())}
              {renderCells(row.getCenterVisibleCells())}
              {renderCells(row.getRightVisibleCells())}
            </TableRow>
          );
        })
      ) : (
        <TableRow>
          <TableCell colSpan={columns.length} className="h-24 text-center">
            No results.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  );
};

function getPinningStyles<TData>(
  column: Column<TData>,
): React.HTMLAttributes<HTMLElement> {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    className: cn(isPinned && "bg-inherit", "shadow-r z-10"),
    style: {
      boxShadow:
        isLastLeftPinnedColumn && column.id !== "__select__"
          ? "-4px 0 4px -4px var(--slate-8) inset"
          : isFirstRightPinnedColumn
            ? "4px 0 4px -4px var(--slate-8) inset"
            : undefined,
      left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
      right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
      opacity: 1,
      position: isPinned ? "sticky" : "relative",
      zIndex: isPinned ? 1 : 0,
      width: column.getSize(),
    },
  };
}

// Update column sizes in table state for column pinning offsets
// https://github.com/TanStack/table/discussions/3947#discussioncomment-9564867
function columnSizingHandler<TData>(
  thead: HTMLTableCellElement | null,
  table: TanStackTable<TData>,
  column: Column<TData>,
) {
  if (!thead) {
    return;
  }
  if (
    table.getState().columnSizing[column.id] ===
    thead.getBoundingClientRect().width
  ) {
    return;
  }

  table.setColumnSizing((prevSizes) => ({
    ...prevSizes,
    [column.id]: thead.getBoundingClientRect().width,
  }));
}

/**
 * Render an unknown value as a string. Converts objects to JSON strings.
 * @param opts.value - The value to render.
 * @param opts.nullAsEmptyString - If true, null values will be "". Else, stringify.
 */
export function renderUnknownValue(opts: {
  value: unknown;
  nullAsEmptyString?: boolean;
}): string {
  const { value, nullAsEmptyString = false } = opts;

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  if (value === null && nullAsEmptyString) {
    return "";
  }
  return String(value);
}
