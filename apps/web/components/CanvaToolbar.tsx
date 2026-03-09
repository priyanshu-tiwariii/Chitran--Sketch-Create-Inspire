"use client";
import React, { useState, useCallback, useEffect } from "react";
import {
  Circle, Eraser, Home, Loader2, LucideIcon, Minus, MousePointer, MoveRight, Pen, Redo,
  Save, Square, Star, Trash2, Triangle, Type, Undo
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
  { name: "hand", icon: MousePointer, tooltip: "Select / Move", shortcut: "V" },
  { name: "pencil", icon: Pen, tooltip: "Pencil", shortcut: "P" },
  { name: "rectangle", icon: Square, tooltip: "Rectangle", shortcut: "R" },
  { name: "circle", icon: Circle, tooltip: "Circle", shortcut: "O" },
  { name: "triangle", icon: Triangle, tooltip: "Triangle", shortcut: "G" },
  { name: "star", icon: Star, tooltip: "Star", shortcut: "S" },
  { name: "line", icon: Minus, tooltip: "Line", shortcut: "L" },
  { name: "arrow", icon: MoveRight, tooltip: "Arrow", shortcut: "A" },
  { name: "text", icon: Type, tooltip: "Text", shortcut: "T" },
  { name: "eraser", icon: Eraser, tooltip: "Eraser", shortcut: "E" },
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

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.altKey) return;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey) {
        if (e.key === 'z') { e.preventDefault(); undo(); return; }
        if (e.key === 'y') { e.preventDefault(); redo(); return; }
        if (e.key === 's') { e.preventDefault(); save(); return; }
        return;
      }

      // Single-key tool shortcuts
      const key = e.key.toUpperCase();
      const tool = primaryTools.find(t => t.shortcut === key);
      if (tool) {
        if (!isEditable() && tool.name !== 'hand') return;
        e.preventDefault();
        setSelectedTool(tool.name);
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, save, setSelectedTool, isEditable]);

  return (
    <>
      {/* Left Vertical Toolbar for Creation Tools */}
      <div className="fixed left-3 top-1/2 -translate-y-1/2 z-50 p-1.5 bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-700/80 shadow-2xl">
        <div className="flex flex-col items-center gap-1">
          {primaryTools.map((tool, index) => (
            <React.Fragment key={tool.name}>
              {/* Separator between select and draw tools, and before eraser */}
              {(index === 1 || index === primaryTools.length - 1) && (
                <div className="w-7 h-px bg-zinc-700 my-0.5" />
              )}
              <ToolButton
                tool={tool}
                isActive={selectedTool === tool.name}
                onClick={() => setSelectedTool(tool.name)}
                disabled={!isEditable() && tool.name !== 'hand'}
              />
            </React.Fragment>
          ))}
          <div className="w-7 h-px bg-zinc-700 my-0.5" />
          <ColorPickerPopover
            selectedColor={activeColor}
            onColorSelect={handleColorSelect}
            disabled={!isEditable()}
          />
        </div>
      </div>

      {/* Top Horizontal Toolbar for Actions */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 p-1.5 bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-700/80 shadow-2xl">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Home size={14} className="text-white" />
            </div>
            <span className="text-zinc-200 font-semibold text-sm hidden sm:inline">Chitran</span>
          </button>
          <div className="h-5 w-px bg-zinc-700" />
          <ActionButton tooltip="Undo (Ctrl+Z)" onClick={undo} disabled={!isEditable()}>
            <Undo size={16} />
          </ActionButton>
          <ActionButton tooltip="Redo (Ctrl+Y)" onClick={redo} disabled={!isEditable()}>
            <Redo size={16} />
          </ActionButton>
          <div className="h-5 w-px bg-zinc-700" />
          <ShareButton />
          <ActionButton tooltip="Clear Canvas" onClick={clear} disabled={!isEditable()} variant="destructive">
            <Trash2 size={16} />
          </ActionButton>
          <div className="h-5 w-px bg-zinc-700" />
         
          <button
            onClick={save}
            disabled={isSaving || !isEditable()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 text-white font-medium text-xs hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 bg-zinc-900/90 backdrop-blur-md rounded-lg border border-zinc-700/80 shadow-2xl">
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
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
  <div className="relative group/tip">
    {children}
    <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
      <div className="bg-zinc-800 text-white text-[11px] px-2 py-1 rounded-md border border-zinc-600 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-nowrap shadow-lg">
        <div className="flex items-center gap-1.5">
          <span>{tooltip}</span>
          {shortcut && <kbd className="text-[10px] text-zinc-400 bg-zinc-700 px-1 rounded">{shortcut}</kbd>}
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
      className={`p-2 rounded-lg transition-all duration-150 flex items-center justify-center
        ${isActive
          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed'
        }
        ${!disabled && !isActive ? 'active:scale-95' : ''}
      `}
    >
      <tool.icon size={18} strokeWidth={1.8} />
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
    default: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed",
    destructive: "text-red-400/70 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
  };
  return (
    <TooltipWrapper tooltip={tooltip}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`p-1.5 rounded-lg transition-colors duration-150 active:scale-95 ${variantClasses[variant]}`}
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
          className="p-2 rounded-lg transition-all duration-150 flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
        >
          <div className="w-4.5 h-4.5 rounded-full border-2 border-zinc-500" style={{ backgroundColor: selectedColor }} />
        </button>
      </Popover.Trigger>
    </TooltipWrapper>
    <Popover.Portal>
      <Popover.Content
        side="right"
        align="center"
        sideOffset={10}
        className="z-[100] p-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 animate-in fade-in-0 zoom-in-95"
      >
        {colors.map(color => (
          <Popover.Close asChild key={color}>
            <button
              onClick={() => onColorSelect(color)}
              className={`w-6 h-6 rounded-md border-2 transition-transform duration-100 hover:scale-110 active:scale-95
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

// All tools are in the primary bar — no secondary popover needed.