"use client";
import React, { useState, useCallback } from "react";
import {
  Circle, Eraser, Home, Loader2, LucideIcon, Minus, MousePointer, MoveRight, Pen, Redo,
  Save, Square, Star, Trash2, Triangle, Type, Undo, X, Palette, MoreVertical
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { ShapeType } from "../types/shape.types";
import ShareButton from "./ShareButton";
import * as Popover from '@radix-ui/react-popover';

// --- PROPS INTERFACE ---
type Props = {
  selectedTool: string;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setSelectedTool: (tool: ShapeType) => void;
  setSelectedColor: (color: string) => void;
  setFontSize: (size: string) => void;
  setFontFamily: (family: string) => void;
  save: () => void;
  isSaving: boolean;
  isContentThere: boolean;
};

// --- TOOL & COLOR DEFINITIONS ---
const primaryTools: { name: ShapeType; icon: LucideIcon; tooltip: string; shortcut: string }[] = [
  { name: "hand", icon: MousePointer, tooltip: "Select", shortcut: "V" },
  { name: "pencil", icon: Pen, tooltip: "Pencil", shortcut: "P" },
  { name: "rectangle", icon: Square, tooltip: "Rectangle", shortcut: "R" },
  { name: "circle", icon: Circle, tooltip: "Circle", shortcut: "C" },
  { name: "line", icon: Minus, tooltip: "Line", shortcut: "L" },
  { name: "arrow", icon: MoveRight, tooltip: "Arrow", shortcut: "A" },
  { name: "text", icon: Type, tooltip: "Text", shortcut: "T" },
];

const secondaryTools: { name: ShapeType; icon: LucideIcon; tooltip: string }[] = [
  { name: "triangle", icon: Triangle, tooltip: "Triangle" },
  { name: "star", icon: Star, tooltip: "Star" },
  { name: "eraser", icon: Eraser, tooltip: "Eraser" },
];

const colors = [
  "#FFFFFF", "#EF4444", "#3B82F6", "#10B981",
  "#F59E0B", "#8B5CF6", "#F97316", "#1F2937",
];

// --- MAIN TOOLBAR COMPONENT ---
export const CanvaToolbar = (props: Props) => {
  const { selectedTool, undo, redo, clear, setSelectedTool, setSelectedColor, save, isSaving } = props;
  const router = useRouter();
  const collaborativeRole = useSelector((state: RootState) => state.collaborative?.collaborativeRole);
  const [activeColor, setActiveColor] = useState('#FFFFFF');

  const isEditable = useCallback(() => {
    return collaborativeRole === "ADMIN" || collaborativeRole === "EDITOR";
  }, [collaborativeRole]);

  const handleColorSelect = (color: string) => {
    setActiveColor(color);
    setSelectedColor(color);
  };

  return (
    <>
      {/* Left Vertical Toolbar for Creation Tools */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 p-2 bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-700 shadow-2xl">
        <div className="flex flex-col items-center gap-1.5">
          {primaryTools.map((tool) => (
            <ToolButton
              key={tool.name}
              tool={tool}
              isActive={selectedTool === tool.name}
              onClick={() => setSelectedTool(tool.name)}
              disabled={!isEditable() && tool.name !== 'hand'}
            />
          ))}
          <div className="w-8 h-px bg-zinc-700 my-1" />
          <ColorPickerPopover
            selectedColor={activeColor}
            onColorSelect={handleColorSelect}
            disabled={!isEditable()}
          />
          <SecondaryToolsPopover
            tools={secondaryTools}
            selectedTool={selectedTool}
            onToolSelect={setSelectedTool}
            disabled={!isEditable()}
          />
        </div>
      </div>

      {/* Top Horizontal Toolbar for Actions */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 p-2 bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-700 shadow-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Home size={16} className="text-white" />
            </div>
            <span className="text-zinc-200 font-semibold text-sm">Chitran</span>
          </button>
          <div className="h-6 w-px bg-zinc-700" />
          <ActionButton tooltip="Undo (Ctrl+Z)" onClick={undo} disabled={!isEditable()}>
            <Undo size={18} />
          </ActionButton>
          <ActionButton tooltip="Redo (Ctrl+Y)" onClick={redo} disabled={!isEditable()}>
            <Redo size={18} />
          </ActionButton>
          <div className="h-6 w-px bg-zinc-700" />
          <ShareButton />
          <ActionButton tooltip="Clear Canvas" onClick={clear} disabled={!isEditable()} variant="destructive">
            <Trash2 size={18} />
          </ActionButton>
          <div className="h-6 w-px bg-zinc-700" />
         
          <button
            onClick={save}
            disabled={isSaving || !isEditable()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 disabled:bg-zinc-600 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-700 shadow-2xl">
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span>Role: <span className="text-zinc-200 font-medium">{collaborativeRole}</span></span>
          <div className="h-3 w-px bg-zinc-700" />
          <span>Tool: <span className="text-zinc-200 font-medium capitalize">{selectedTool}</span></span>
        </div>
      </div>
    </>
  );
};

// --- REFINED & REUSABLE SUB-COMPONENTS ---

const TooltipWrapper = ({ tooltip, shortcut, children }: { tooltip: string, shortcut?: string, children: React.ReactNode }) => (
  <div className="relative group">
    {children}
    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
      <div className="bg-zinc-800 text-white text-xs px-2.5 py-1.5 rounded-md border border-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg">
        <div className="flex items-center gap-2">
          <span>{tooltip}</span>
          {shortcut && <span className="text-zinc-400 text-xs">({shortcut})</span>}
        </div>
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-800" />
      </div>
    </div>
  </div>
);

const ToolButton = ({ tool, isActive, onClick, disabled }: {
  tool: { name: ShapeType; icon: LucideIcon; tooltip: string; shortcut?: string };
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <TooltipWrapper tooltip={tool.tooltip} shortcut={tool.shortcut}>
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2.5 rounded-lg transition-all duration-200 flex items-center justify-center
        {/* --- UI/UX CHANGE: Active tool state now uses the primary brand color --- */}
        ${isActive
          ? 'bg-orange-500 text-white scale-110 shadow-lg shadow-orange-500/20'
          : 'text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
        }
        ${!disabled && !isActive ? 'hover:scale-110' : ''}
      `}
    >
      <tool.icon size={20} strokeWidth={2} />
    </button>
  </TooltipWrapper>
);

type ActionButtonProps = {
  tooltip: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
};

const ActionButton = ({
  tooltip,
  children,
  onClick,
  disabled,
  variant = "default",
}: ActionButtonProps) => {
  const variantClasses: { [key in "default" | "destructive"]: string } = {
    default: "text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed",
    destructive: "text-red-400 hover:bg-red-900/50 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
  };
  return (
    <TooltipWrapper tooltip={tooltip}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`p-2 rounded-lg transition-colors duration-200 ${variantClasses[variant]}`}
      >
        {children}
      </button>
    </TooltipWrapper>
  );
};

const ColorPickerPopover = ({ selectedColor, onColorSelect, disabled }: {
  selectedColor: string;
  onColorSelect: (color: string) => void;
  disabled?: boolean;
}) => (
  <Popover.Root>
    <TooltipWrapper tooltip="Color">
      <Popover.Trigger asChild disabled={disabled}>
        <button
          className="p-2.5 rounded-lg transition-all duration-200 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-110"
        >
          <div className="w-5 h-5 rounded-full border-2 border-zinc-400" style={{ backgroundColor: selectedColor }} />
        </button>
      </Popover.Trigger>
    </TooltipWrapper>
    <Popover.Portal>
      <Popover.Content
        side="right"
        align="center"
        sideOffset={12}
        className="z-[100] p-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl grid grid-cols-4 gap-1.5 animate-in fade-in-0 zoom-in-95"
      >
        {colors.map(color => (
          <Popover.Close asChild key={color}>
            <button
              onClick={() => onColorSelect(color)}
              className={`w-6 h-6 rounded-md border-2 transition-transform duration-150 hover:scale-110
                {/* --- UI/UX CHANGE: Selected color border now uses the primary brand color --- */}
                ${selectedColor === color ? 'border-orange-500 scale-110' : 'border-zinc-600'}
              `}
              style={{ backgroundColor: color }}
            />
          </Popover.Close>
        ))}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);

const SecondaryToolsPopover = ({ tools, selectedTool, onToolSelect, disabled }: {
  tools: { name: ShapeType; icon: LucideIcon; tooltip: string }[];
  selectedTool: string;
  onToolSelect: (tool: ShapeType) => void;
  disabled?: boolean;
}) => (
  <Popover.Root>
    <TooltipWrapper tooltip="More Tools">
      <Popover.Trigger asChild disabled={disabled}>
        <button className="p-2.5 rounded-lg transition-all duration-200 flex items-center justify-center text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-110">
          <MoreVertical size={20} />
        </button>
      </Popover.Trigger>
    </TooltipWrapper>
    <Popover.Portal>
      <Popover.Content
        side="right"
        align="center"
        sideOffset={12}
        className="z-[100] p-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl flex flex-col gap-1 animate-in fade-in-0 zoom-in-95"
      >
        {tools.map((tool) => (
          <Popover.Close asChild key={tool.name}>
            <ToolButton
              tool={tool}
              isActive={selectedTool === tool.name}
              onClick={() => onToolSelect(tool.name)}
              disabled={disabled}
            />
          </Popover.Close>
        ))}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);