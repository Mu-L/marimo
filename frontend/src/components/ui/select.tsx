/* Copyright 2024 Marimo. All rights reserved. */

import * as SelectPrimitive from "@radix-ui/react-select";
import type { VariantProps } from "class-variance-authority";
import {
  CheckIcon,
  ChevronDown,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { StyleNamespace } from "@/theme/namespace";
import { cn } from "@/utils/cn";
import { withFullScreenAsRoot } from "./fullscreen";
import { MENU_ITEM_DISABLED } from "./menu-items";
import { selectStyles } from "./native-select";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;
const SelectPortal = withFullScreenAsRoot(SelectPrimitive.Portal);

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    onClear?: () => void;
    hideChevron?: boolean;
  } & VariantProps<typeof selectStyles>
>(
  (
    { className, children, onClear, variant, hideChevron = false, ...props },
    ref,
  ) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(selectStyles({ variant }), "mb-0", className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild={true}>
        {onClear ? (
          <span
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }}
          >
            <XIcon className="h-4 w-4 opacity-50 hover:opacity-90" />
          </span>
        ) : (
          !hideChevron && <ChevronDown className="h-4 w-4 opacity-50" />
        )}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  ),
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPortal>
    <StyleNamespace>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "max-h-[300px] relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-[20px] bg-background text-muted-foreground cursor-default">
          <ChevronUpIcon className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>

        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>

        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-[20px] bg-background text-muted-foreground cursor-default">
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </StyleNamespace>
  </SelectPortal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    subtitle?: React.ReactNode; // Subtitle is not displayed in input field
  }
>(({ className, children, subtitle, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground",
      MENU_ITEM_DISABLED,
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="h-3 w-3" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText
      asChild={typeof children === "string" ? undefined : true}
      className="flex w-full flex-1"
    >
      {children}
    </SelectPrimitive.ItemText>
    {subtitle}
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
