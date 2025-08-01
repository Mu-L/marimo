/* Copyright 2024 Marimo. All rights reserved. */

import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import {
  ChartColumnIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  DatabaseIcon,
  PaintRollerIcon,
  XIcon,
} from "lucide-react";
import type { JSX } from "react";
import React, { useMemo, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import useResizeObserver from "use-resize-observer";
import { PythonIcon } from "@/components/editor/cell/code/icons";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CellId } from "@/core/cells/ids";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import type { GetDataUrl } from "@/plugins/impl/DataTablePlugin";
import { vegaLoadData } from "@/plugins/impl/vega/loader";
import { useTheme } from "@/theme/useTheme";
import { inferFieldTypes } from "../columns";
import type { FieldTypesWithExternalType } from "../types";
import { generateAltairChartSnippet } from "./chart-spec/altair-generator";
import { createSpecWithoutData } from "./chart-spec/spec";
import { ChartTypeSelect } from "./components/chart-items";
import { ChartErrorState, ChartLoadingState } from "./components/chart-states";
import type { Field } from "./components/form-fields";
import { CodeSnippet, TabContainer } from "./components/layouts";
import { ChartFormContext } from "./context";
import { CommonChartForm, StyleForm } from "./forms/common-chart";
import { HeatmapForm } from "./forms/heatmap";
import { PieForm } from "./forms/pie";
import { LazyChart } from "./lazy-chart";
import { ChartSchema, type ChartSchemaType, getChartDefaults } from "./schemas";
import { getChartTabName, type TabName, tabsStorageAtom } from "./storage";
import { ChartType } from "./types";

const NEW_CHART_TYPE = "bar" as ChartType;
const DEFAULT_TAB_NAME = "table" as TabName;
const CHART_HEIGHT = 290;

export interface TablePanelProps {
  cellId: CellId | null;
  dataTable: JSX.Element;
  displayHeader: boolean;
  getDataUrl?: GetDataUrl;
  fieldTypes?: FieldTypesWithExternalType | null;
}

export const TablePanel: React.FC<TablePanelProps> = ({
  cellId,
  dataTable,
  getDataUrl,
  fieldTypes,
  displayHeader,
}) => {
  const [tabsMap, saveTabsMap] = useAtom(tabsStorageAtom);
  const tabs = cellId ? (tabsMap.get(cellId) ?? []) : [];

  const [tabNum, setTabNum] = useState(0);
  const [selectedTab, setSelectedTab] = useState(DEFAULT_TAB_NAME);

  if (!displayHeader || (tabs.length === 0 && !displayHeader)) {
    return dataTable;
  }

  const handleAddTab = () => {
    if (!cellId) {
      return;
    }
    const tabName = getChartTabName(tabNum, NEW_CHART_TYPE);

    const newTabs = new Map(tabsMap);
    newTabs.set(cellId, [
      ...tabs,
      {
        tabName,
        chartType: NEW_CHART_TYPE,
        config: getChartDefaults(),
      },
    ]);

    saveTabsMap(newTabs);
    setTabNum(tabNum + 1);
    setSelectedTab(tabName);
  };

  const handleDeleteTab = (tabName: TabName) => {
    if (!cellId) {
      return;
    }
    const newTabs = new Map(tabsMap);
    newTabs.set(
      cellId,
      tabs.filter((tab) => tab.tabName !== tabName),
    );
    saveTabsMap(newTabs);
    setSelectedTab(DEFAULT_TAB_NAME);
    setTabNum(tabNum - 1);
  };

  const saveTabChart = ({
    tabName,
    chartType,
    chartConfig,
  }: {
    tabName: TabName;
    chartType: ChartType;
    chartConfig: ChartSchemaType;
  }) => {
    if (!cellId) {
      return;
    }

    const updatedTabs = new Map(tabsMap);
    updatedTabs.set(
      cellId,
      tabs.map((tab) =>
        tab.tabName === tabName
          ? { ...tab, chartType, config: chartConfig }
          : tab,
      ),
    );
    saveTabsMap(updatedTabs);
  };

  const saveTabChartType = (tabName: TabName, chartType: ChartType) => {
    if (!cellId) {
      return;
    }

    const tabs = tabsMap.get(cellId) ?? [];
    const tabIndex = tabs.findIndex((tab) => tab.tabName === tabName);
    if (tabIndex === -1) {
      return;
    }

    const newTabs = tabs.map((tab) =>
      tab.tabName === tabName
        ? {
            ...tab,
            chartType,
            tabName: getChartTabName(tabIndex, chartType),
          }
        : tab,
    );

    const newTabsMap = new Map(tabsMap).set(cellId, newTabs);
    saveTabsMap(newTabsMap);
    setSelectedTab(newTabs[tabIndex].tabName);
  };

  return (
    <Tabs value={selectedTab} className="-mt-1">
      <TabsList>
        <TabsTrigger
          className="text-xs"
          value={DEFAULT_TAB_NAME}
          onClick={() => setSelectedTab(DEFAULT_TAB_NAME)}
        >
          Table
        </TabsTrigger>
        {tabs.map((tab, idx) => (
          <TabsTrigger
            key={idx}
            className="text-xs"
            value={tab.tabName}
            onClick={() => setSelectedTab(tab.tabName)}
          >
            {tab.tabName}
            <XIcon
              className="w-3 h-3 ml-1 mt-[0.5px] hover:text-red-500 hover:font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTab(tab.tabName);
              }}
            />
          </TabsTrigger>
        ))}
        <Button
          variant="text"
          size="icon"
          onClick={handleAddTab}
          title="Add chart"
        >
          +
        </Button>
      </TabsList>

      <TabsContent className="mt-1 overflow-hidden" value={DEFAULT_TAB_NAME}>
        {dataTable}
      </TabsContent>
      {tabs.map((tab, idx) => {
        const saveChart = (formValues: ChartSchemaType) => {
          saveTabChart({
            tabName: tab.tabName,
            chartType: tab.chartType,
            chartConfig: formValues,
          });
        };
        const saveChartType = (chartType: ChartType) => {
          saveTabChartType(tab.tabName, chartType);
        };
        return (
          <TabsContent key={idx} value={tab.tabName} className="h-[400px] mt-1">
            <ChartPanel
              chartConfig={tab.config}
              chartType={tab.chartType}
              saveChart={saveChart}
              saveChartType={saveChartType}
              getDataUrl={getDataUrl}
              fieldTypes={fieldTypes ?? inferFieldTypes(dataTable.props.data)}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
};

const CHART_PLACEHOLDER_CODE = "X and Y columns are not set";

export const ChartPanel: React.FC<{
  chartConfig: ChartSchemaType | null;
  chartType: ChartType;
  saveChart: (formValues: ChartSchemaType) => void;
  saveChartType: (chartType: ChartType) => void;
  getDataUrl?: GetDataUrl;
  fieldTypes?: FieldTypesWithExternalType | null;
}> = ({
  chartConfig,
  chartType,
  saveChart,
  saveChartType,
  getDataUrl,
  fieldTypes,
}) => {
  const { theme } = useTheme();
  const form = useForm<ChartSchemaType>({
    defaultValues: chartConfig ?? getChartDefaults(),
    resolver: zodResolver(ChartSchema),
  });

  const [selectedChartType, setSelectedChartType] =
    useState<ChartType>(chartType);
  const [formCollapsed, setFormCollapsed] = useState(false);

  const { ref: chartContainerRef } = useResizeObserver();

  const { data, isPending, error } = useAsyncData(async () => {
    if (!getDataUrl) {
      return [];
    }

    const response = await getDataUrl({});
    if (Array.isArray(response.data_url)) {
      return response.data_url;
    }

    const chartData = await vegaLoadData(
      response.data_url,
      response.format === "arrow"
        ? { type: "arrow" }
        : response.format === "json"
          ? { type: "json" }
          : { type: "csv", parse: "auto" },
      {
        replacePeriod: true,
      },
    );
    return chartData;
  }, []);

  const formValues = form.watch();

  // This ensures the chart re-renders when the actual values change
  const memoizedFormValues = useMemo(() => {
    return structuredClone(formValues);
  }, [formValues]);

  const specWithoutData = createSpecWithoutData(
    selectedChartType,
    memoizedFormValues,
    theme,
    "container",
    CHART_HEIGHT,
  );

  // Prevent unnecessary re-renders of the chart
  const memoizedChart = useMemo(() => {
    if (isPending) {
      return <ChartLoadingState />;
    }
    if (error) {
      return <ChartErrorState error={error} />;
    }
    return (
      <LazyChart baseSpec={specWithoutData} data={data} height={CHART_HEIGHT} />
    );
  }, [isPending, error, specWithoutData, data]);

  const developmentMode = import.meta.env.DEV;

  const renderChartDisplay = () => {
    let altairCodeSnippet = CHART_PLACEHOLDER_CODE;
    if (typeof specWithoutData !== "string") {
      altairCodeSnippet = generateAltairChartSnippet(
        specWithoutData,
        "_df",
        "_chart",
      );
    }

    return (
      <Tabs defaultValue="chart">
        <div className="flex flex-row gap-1.5 items-center">
          <TabsList>
            <TabsTrigger value="chart" className="h-6">
              <ChartColumnIcon className="text-muted-foreground mr-2 w-4 h-4" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="code" className="h-6">
              <PythonIcon className="text-muted-foreground mr-2" />
              Python code
            </TabsTrigger>
            {developmentMode && (
              <>
                <TabsTrigger value="formValues" className="h-6">
                  <CodeIcon className="text-muted-foreground mr-2 w-4 h-4" />
                  Form values (debug)
                </TabsTrigger>
                <TabsTrigger value="vegaSpec" className="h-6">
                  <CodeIcon className="text-muted-foreground mr-2 w-4 h-4" />
                  Vega spec (debug)
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <TabsContent value="chart" ref={chartContainerRef}>
          {memoizedChart}
        </TabsContent>
        <TabsContent value="code">
          <CodeSnippet
            code={altairCodeSnippet}
            insertNewCell={altairCodeSnippet !== CHART_PLACEHOLDER_CODE}
            language="python"
          />
        </TabsContent>
        {developmentMode && (
          <>
            <TabsContent value="formValues">
              <CodeSnippet
                code={JSON.stringify(formValues, null, 2)}
                language="python"
              />
            </TabsContent>
            <TabsContent value="vegaSpec">
              <CodeSnippet
                code={JSON.stringify(specWithoutData, null, 2)}
                language="python"
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    );
  };

  const chartForm = (
    <>
      <ChartTypeSelect
        value={selectedChartType}
        onValueChange={(value) => {
          setSelectedChartType(value);
          saveChartType(value);
        }}
      />

      <ChartFormContainer
        form={form}
        saveChart={saveChart}
        fieldTypes={fieldTypes}
        chartType={selectedChartType}
      />
    </>
  );

  return (
    <div className="flex flex-row gap-2 h-full rounded-md border pr-2">
      <div
        className={`relative flex flex-col gap-2 overflow-auto px-2 py-3 scrollbar-thin transition-width duration-200 ${formCollapsed ? "w-8" : "w-[300px]"}`}
      >
        {!formCollapsed && chartForm}
        <Button
          variant="outline"
          size="icon"
          className="border-border ml-auto"
          onClick={() => setFormCollapsed((prev) => !prev)}
          title={formCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {formCollapsed ? (
            <ChevronRightIcon className="w-4 h-5" />
          ) : (
            <ChevronLeftIcon className="w-4 h-5" />
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-auto h-full w-full mt-3">
        {renderChartDisplay()}
      </div>
    </div>
  );
};

const ChartFormContainer = ({
  form,
  saveChart,
  fieldTypes,
  chartType,
}: {
  form: UseFormReturn<ChartSchemaType>;
  chartType: ChartType;
  saveChart: (formValues: ChartSchemaType) => void;
  fieldTypes?: FieldTypesWithExternalType | null;
}) => {
  let fields: Field[] = [];
  if (fieldTypes) {
    fields = fieldTypes.map((field) => {
      return {
        name: field[0],
        type: field[1][0],
      };
    });
  }

  const debouncedSave = useDebouncedCallback(() => {
    const values = form.getValues();
    saveChart(values);
  }, 300);

  let ChartForm = CommonChartForm;

  if (chartType === ChartType.PIE) {
    ChartForm = PieForm;
  } else if (chartType === ChartType.HEATMAP) {
    ChartForm = HeatmapForm;
  }

  return (
    <ChartFormContext value={{ fields, saveForm: debouncedSave, chartType }}>
      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} onChange={debouncedSave}>
          <Tabs defaultValue="data">
            <TabsList className="w-full">
              <TabsTrigger value="data" className="w-1/2 h-6">
                <DatabaseIcon className="w-4 h-4 mr-2" />
                Data
              </TabsTrigger>
              <TabsTrigger value="style" className="w-1/2 h-6">
                <PaintRollerIcon className="w-4 h-4 mr-2" />
                Style
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data">
              <hr className="my-2" />
              <TabContainer>
                <ChartForm />
              </TabContainer>
            </TabsContent>

            <TabsContent value="style">
              <hr className="my-2" />
              <TabContainer>
                <StyleForm />
              </TabContainer>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </ChartFormContext>
  );
};
