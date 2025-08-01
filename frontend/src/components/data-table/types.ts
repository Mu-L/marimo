/* Copyright 2024 Marimo. All rights reserved. */

import type { DataType } from "@/core/kernel/messages";
import { Objects } from "@/utils/objects";

export type ColumnName = string;

export const ColumnHeaderStatsKeys = [
  "total",
  "nulls",
  "unique",
  "true",
  "false",
  "min",
  "max",
  "mean",
  "median",
  "std",
  "p5",
  "p25",
  "p75",
  "p95",
] as const;
export type ColumnHeaderStatsKey = (typeof ColumnHeaderStatsKeys)[number];
export type ColumnHeaderStats = Record<
  ColumnHeaderStatsKey,
  number | string | null
>;

export type FieldTypesWithExternalType = Array<
  [columnName: string, [dataType: DataType, externalType: string]]
>;
export type FieldTypes = Record<string, DataType>;

export function toFieldTypes(
  fieldTypes: FieldTypesWithExternalType,
): FieldTypes {
  return Objects.collect(
    fieldTypes,
    ([columnName]) => columnName,
    ([, [type]]) => type,
  );
}

interface BinValue {
  bin_start: number | string | Date | null;
  bin_end: number | string | Date | null;
  count: number;
}
export type BinValues = BinValue[];

interface ValueCount {
  value: string;
  count: number;
}
export type ValueCounts = ValueCount[];

export const SELECT_COLUMN_ID = "__select__";

export const INDEX_COLUMN_NAME = "_marimo_row_id";

export const TOO_MANY_ROWS = "too_many";
export type TooManyRows = typeof TOO_MANY_ROWS;

export type DataTableSelection =
  | "single"
  | "multi"
  | "single-cell"
  | "multi-cell"
  | null;

export function extractTimezone(dtype: string | undefined): string | undefined {
  if (!dtype) {
    return undefined;
  }
  // Check for datetime[X,Y] and datetime64[X,Y] format
  // We do this for any timezone-aware datetime type
  // not just UTC (as this is what Polars does by default)
  const match = /^datetime(?:64)?\[[^,]+,([^,]+)]$/.exec(dtype);
  return match?.[1]?.trim();
}
