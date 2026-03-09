'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import throttle from 'lodash/throttle';
import { Stage, Layer, Rect } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Vector2d } from 'konva/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { CanvaToolbar } from '../../../components/CanvaToolbar';
import type { Shape, ShapeType } from "@repo/common/types";
import axios from 'axios';
import { CANVAS_URL, COLLAB_MODE_URL, COLLAB_URL } from '../../../lib/apiEndPoints';
import { SingletonSocket } from '../../../lib/socket';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../redux/store';
import { setCollaborativeRole, setIsCollaborative } from '../../../redux/collaborativeSlice';
import { ShapeRenderer } from '../../../components/ShapeRenderer';
import { CursorRenderer } from '../../../components/CursorRenderer';

declare module 'next-auth' {
  interface Session {
    user: { id?: string | null; name?: string | null; email?: string | null; image?: string | null; token?: string | null; };
  }
}
type Cursor = {
  position: { x: number, y: number };
  user: { name: string, email: string };
};
type Cursors = Record<string, Cursor>; 
type Locks = Record<string, string>;

// Represents a single reversible action on the canvas.
// Using an action stack (not snapshot array) means undo/redo only touches
// the local user's own shapes and always emits socket events, keeping all
// collaborators in sync.
type HistoryAction = {
  action: 'add' | 'update' | 'delete';
  shape: Shape;
  previousShape?: Shape; // Only set for 'update' actions. Holds the pre-edit state.
};

// ---------------------------------------------------------------------------
// Pure helpers — hoisted outside the component so they are module-level
// stable references and never need to appear in useCallback/useEffect dep arrays.
// ---------------------------------------------------------------------------

// normalize negative width/height and map legacy wire-format fields (w/h)
function normalizeShapeSize(shape: Shape): Shape {
  // Cast to access the optional legacy `w`/`h` fields that may arrive
  // from old server payloads before they are standardised.
  const raw = shape as Shape & { w?: number; h?: number };
  const width = raw.width ?? raw.w ?? 0;
  const height = raw.height ?? raw.h ?? 0;
  let x = shape.x;
  let y = shape.y;
  let w = width;
  let h = height;

  if (w < 0) { x = x + w; w = Math.abs(w); }
  if (h < 0) { y = y + h; h = Math.abs(h); }

  return {
    ...shape,
    x,
    y,
    width: w,
    height: h,
    strokeWidth: shape.strokeWidth ?? 2,
    points: shape.points ?? [],
    rotation: shape.rotation ?? 0,
    radius: shape.radius ?? 0,
    text: shape.text ?? '',
    fontSize: shape.fontSize ?? 16,
    fontFamily: shape.fontFamily ?? 'Arial',
    color: shape.color ?? '#000000',
  };
}

// Map a raw server / socket payload to a fully-typed Shape.
function normalizeIncoming(s: Record<string, unknown>): Shape {
  return normalizeShapeSize({
    id: s.id as string,
    type: s.type as Shape['type'],
    x: (s.x as number) ?? 0,
    y: (s.y as number) ?? 0,
    width: (s.width as number) ?? (s.w as number) ?? 0,
    height: (s.height as number) ?? (s.h as number) ?? 0,
    strokeWidth: (s.strokeWidth as number) ?? 2,
    radius: (s.radius as number) ?? 0,
    text: (s.text as string) ?? '',
    fontSize: (s.fontSize as number) ?? 16,
    fontFamily: (s.fontFamily as string) ?? 'Arial',
    color: (s.color as string) ?? '#000000',
    points: (s.points as number[]) ?? [],
    rotation: (s.rotation as number) ?? 0,
  });
}


export default function CanvasPage() {
  // --- State Management ---
  const [shapes, _setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<HistoryAction[]>([]);
  // -1 = nothing to undo. Points at the most recent action entry.
  const [historyStep, setHistoryStep] = useState(-1);



  const [selectedTool, setSelectedTool] = useState<ShapeType>('hand');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState("#ffffff");

  const [viewPortTransform, setViewPortTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  const [lockedShapes, setLockedShapes] = useState<Locks>({});
  const [cursors, setCursors] = useState<Cursors>({});

  const [initialLoading, setInitialLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // --- Refs ---
  const isDrawingRef = useRef(isDrawing);
  const stageRef = useRef<any>(null);
  const shapesRef = useRef<Shape[]>([]);
  // Tracks the ID of the shape currently being drawn locally.
  // Using a ref (not state) avoids stale-closure issues and prevents re-renders.
  // Critical for multiplayer: without this, an incoming socket shape could
  // become the last array item and get overwritten by handleMouseMove.
  const draftShapeIdRef = useRef<string | null>(null);
  // Mirrors historyStep in a ref so pushHistory (useCallback with empty deps)
  // can always read the current step without being added to every dep array.
  const historyStepRef = useRef(-1);

  // Stable throttled cursor emitter — created once, never recreated.
  // 50 ms = max 20 fps of cursor:move events over the network.
  const throttledCursorEmit = useRef(
    throttle((payload: object) => {
      SingletonSocket.getInstance()?.emit('cursor:move', payload);
    }, 50)
  ).current;
  // helper setter to keep ref in sync with state
  const setShapesAndRef = (updater: Shape[] | ((prev: Shape[]) => Shape[])) => {
    if (typeof updater === 'function') {
      _setShapes(prev => {
        const next = (updater as (prev: Shape[]) => Shape[])(prev);
        shapesRef.current = next;
        return next;
      });
    } else {
      shapesRef.current = updater;
      _setShapes(updater);
    }
  };

  // --- Hooks and Context ---
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const dispatch = useDispatch();
  const { collaborativeRole } = useSelector((state: RootState) => state.collaborative);

  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);

  // --- Utility Functions ---
  const isAllowedToDraw = useCallback(() => collaborativeRole === 'ADMIN' || collaborativeRole === 'EDITOR', [collaborativeRole]);

  const getPointerPosition = (): Vector2d | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;

    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  };

  // Keep historyStepRef in sync whenever historyStep state changes (e.g. undo/redo).
  useEffect(() => { historyStepRef.current = historyStep; }, [historyStep]);

  // --- History Management ---
  // Pushes a reversible HistoryAction onto the stack, truncating any
  // "future" entries invalidated by this new action.
  // Uses historyStepRef (not state) so the useCallback dep array stays empty
  // and the function reference never changes — keeping dependent callbacks stable.
  const pushHistory = useCallback((action: HistoryAction) => {
    const currentStep = historyStepRef.current;
    setHistory(prev => prev.slice(0, currentStep + 1).concat(action));
    const nextStep = currentStep + 1;
    historyStepRef.current = nextStep; // optimistic sync before state flush
    setHistoryStep(nextStep);
  }, []);

  // --- Canvas State Sync ---
  // Fetches the authoritative DB state and overwrites local shapes.
  // Called on initial load AND on every socket reconnection to recover
  // events missed during a disconnection window.
  const fetchCanvasState = useCallback(async () => {
    const fileId = params.fileId as string;
    const token = session?.user?.token;
    if (!fileId || !token) return;
    try {
      const res = await axios.get(`${CANVAS_URL}/${fileId}`, { headers: { Authorization: token } });
      const incomingShapes = (res.data.data ?? []).map(normalizeIncoming);
      setShapesAndRef(incomingShapes);
    } catch (err) {
      console.error('Canvas re-sync failed:', err);
    }
  }, [params.fileId, session?.user?.token]);

  // --- Data Fetching and Socket Setup ---
  useEffect(() => {
    const fileId = params.fileId as string;
    const token = session?.user?.token;
    if (!fileId || !token) return;

    const setup = async () => {
      try {
        const [collabStatusRes, collabRes, canvasRes] = await Promise.all([
          axios.get(`${COLLAB_MODE_URL}/${fileId}`, { headers: { Authorization: token } }),
          axios.get(`${COLLAB_URL}/isCollab/${fileId}`, { headers: { Authorization: token } }),
          axios.get(`${CANVAS_URL}/${fileId}`, { headers: { Authorization: token } })
        ]);

        const isCollabActive = collabStatusRes.data.data;
        dispatch(setIsCollaborative(isCollabActive));
        const { role, fileId: verifiedFileId } = collabRes.data.data;
        dispatch(setCollaborativeRole(role));

        if (verifiedFileId !== fileId || (!isCollabActive && role !== 'ADMIN')) {
          router.push('/dashboard'); 
          return;
        }

        const initialShapes = (canvasRes.data.data ?? []).map(normalizeIncoming);
        setShapesAndRef(initialShapes);
        // History starts empty — the server state is the baseline, not a local action.

        if (isCollabActive) {
          const socket = SingletonSocket.getInstance(token);
          if (socket) {
            if (!socket.connected) socket.connect();
            socket.on('connect', () => {
              // Re-join the room so the server knows we're here.
              socket.emit("join-file", verifiedFileId, session?.user?.id, role);
              // Re-fetch DB state to recover any events missed while disconnected.
              fetchCanvasState();
            });
            socket.on('stroke:create', (payload: { stroke: Shape }) => {
              setShapesAndRef(prev => {
                const filtered = prev.filter(s => s.id !== payload.stroke.id);
                const normalized = normalizeShapeSize(payload.stroke);
                return [...filtered, normalized];
              });
            });
            socket.on('stroke:delete', (payload: { stroke: string }) => {
              setShapesAndRef(prev => prev.filter(s => s.id !== payload.stroke));
            });
            socket.on('strokes:delete', (payload: { strokes: string[] }) => {
              setShapesAndRef(prev => prev.filter(s => !payload.strokes.includes(s.id)));
            });

            socket.on("shape:is-locked", (payload: { shapeId: string, userId: string }) => {
              setLockedShapes(prev => ({ ...prev, [payload.shapeId]: payload.userId }));
              if (payload.userId === session?.user?.id) {
                setSelectedShapeId(payload.shapeId);
              }
            });

            socket.on("shape:is-unlocked", (payload: { shapeId: string }) => {
              setLockedShapes(prev => {
                const next = { ...prev };
                delete next[payload.shapeId];
                return next;
              });
            });

            socket.on("shape:lock-failed", (payload: { shapeId: string }) => {
              toast.error("Another user is editing this shape.");
            });

            
           socket.on("cursor:update", (payload: any) => {
              try {
                
                const userId = payload.userId ?? payload.user?.id ?? payload.id ?? null;
                if (!userId) return; // nothing useful to store

                const position = payload.position ?? { x: 0, y: 0 };
                const user = {
                  name: payload.user?.name ?? payload.name ?? 'Anonymous',
                  email: payload.user?.email ?? payload.email ?? ''
                };

                setCursors(prev => ({ ...prev, [userId]: { position, user } }));
              } catch (err) {
                console.warn('Malformed cursor:update payload', payload, err);
              }
            });


            socket.on("cursor:leave", (payload: { userId: string }) => {
              setCursors(prev => {
                const next = { ...prev };
                delete next[payload.userId];
                return next;
              });
            });
          }
        }
      } catch (error) { 
        console.error("Error setting up canvas:", error); 
      } finally { 
        setInitialLoading(false); 
      }
    };
    setup();

    return () => {
      const socket = SingletonSocket.getInstance();
      if (socket) {
        // Remove only the listeners registered in this effect.
        // Do NOT call socket.disconnect() — the singleton must stay alive
        // so navigating back to a canvas reconnects instantly without
        // re-authenticating. Disconnecting would destroy the shared instance.
        socket.off('connect');
        socket.off('stroke:create');
        socket.off('stroke:delete');
        socket.off('strokes:delete');
        socket.off('shape:is-locked');
        socket.off('shape:is-unlocked');
        socket.off('shape:lock-failed');
        socket.off('cursor:update');
        socket.off('cursor:leave');
        socket.emit('leave-file', fileId);
      }
    };
  }, [params.fileId, session?.user?.token, session?.user?.id, dispatch, router, fetchCanvasState]);

  // --- Drawing Handlers ---
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (e.target === stage) {
      if (selectedShapeId) {
        SingletonSocket.getInstance()?.emit("shape:unlock", {
          fileId: params.fileId,
          shapeId: selectedShapeId,
          userId: session?.user?.id
        });
      }
      setSelectedShapeId(null);
    }

    if (selectedTool === 'text') {
      if (editingTextId) {
        return;
      }
      if (!isAllowedToDraw()) return;
      const pos = getPointerPosition();
      if (!pos) return;
      const newShape: Shape = {
        id: `${session?.user?.id}-${Date.now()}`,
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: 'Text',
        color: strokeColor,
        fontSize: 16,
        fontFamily: 'Arial',
        strokeWidth: 0,
        rotation: 0,
        width: 60, 
        height: 20,
      };
      
      const normalized = normalizeShapeSize(newShape);
      setShapesAndRef(prev => [...prev, normalized]);
      pushHistory({ action: 'add', shape: normalized });
      setSelectedShapeId(normalized.id);
      setEditingTextId(normalized.id);
      
      // 4. Broadcast creation
      if (SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: normalized });
      }
      setSelectedTool('hand');

      setIsDrawing(false); 
      return; 
    }


    const isDrawingTool = ['rectangle', 'circle', 'line', 'arrow', 'pencil', 'star', 'triangle', 'text'].includes(selectedTool);

    if (!isAllowedToDraw() || (!isDrawingTool && selectedTool !== 'eraser' && selectedTool !== 'hand')) return;

    setIsDrawing(true);
    const pos = getPointerPosition();
    if (!pos) return;

    if (isDrawingTool) {
      const newId = `${session?.user?.id}-${Date.now()}`;
      draftShapeIdRef.current = newId;
      const newShape: Shape = {
        id: newId,
        type: selectedTool as ShapeType,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color: strokeColor,
        points: selectedTool === 'pencil' ? [0, 0] : [],
        strokeWidth: 2,
        rotation: 0,
        radius: 0,
        text: '',
        fontSize: 16,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        fontStyle: 'normal',
      };
      setShapesAndRef(prev => [...prev, newShape]);
    }
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    // --- FIX 1: CURSOR & HEARTBEAT LOGIC MOVED TO THE TOP ---
    const pos = getPointerPosition();
    if (pos && session?.user && SingletonSocket.getInstance()?.connected) {
      // A. Broadcast our cursor position — throttled to 20 fps max.
      throttledCursorEmit({
        fileId: params.fileId,
        position: pos,
        user: {
          name: session.user.name || 'Anonymous',
          email: session.user.email || ''
        }
      });

      // B. Broadcast lock-refresh "heartbeat" if dragging a locked shape
      if (isDrawingRef.current && selectedTool === 'hand' && selectedShapeId) {
        SingletonSocket.getInstance()?.emit("shape:lock-refresh", {
          fileId: params.fileId,
          shapeId: selectedShapeId,
          userId: session?.user?.id
        });
      }
    }

    // --- ORIGINAL DRAWING LOGIC (UNCHANGED) ---
    if (!isDrawingRef.current || !isAllowedToDraw()) return;
    const isDrawingTool = ['rectangle', 'circle', 'line', 'arrow', 'pencil', 'star', 'triangle', 'text'].includes(selectedTool);
    if (!isDrawingTool) {
        return; 
    }
    
    if (!pos) return; // Already got pos, but double-check

    setShapesAndRef(prev => {
      const draftId = draftShapeIdRef.current;
      if (!draftId || !isDrawingRef.current) return prev;

      const idx = prev.findIndex(s => s.id === draftId);
      if (idx === -1) return prev;

      const draft = prev[idx]!;
      const updated = { ...draft };
      const startX = updated.x;
      const startY = updated.y;

      if (updated.type === 'pencil') {
        updated.points = [...(updated.points ?? [0, 0]), pos.x - startX, pos.y - startY];
      } else {
        updated.width = pos.x - startX;
        updated.height = pos.y - startY;
      }

      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return;
    setIsDrawing(false);

    // Capture and clear the draft ID atomically before any async work.
    const draftId = draftShapeIdRef.current;
    draftShapeIdRef.current = null;

    if (selectedTool === 'hand') {
      // Don't unlock/deselect the shape on mouseUp — the user may have just
      // finished dragging the shape. Deselection only happens when clicking
      // empty canvas area (handled in handleMouseDown → e.target === stage).
      return;
    }
  

    const currentShapes = shapesRef.current;
    if (currentShapes.length === 0) return;
    // Look up the draft shape by its stable ID, not by array position.
    // Array position is unreliable in multiplayer — incoming socket strokes
    // may have been appended between mousedown and mouseup.
    const draftShape = draftId ? currentShapes.find(s => s.id === draftId) ?? null : null;
    if (!draftShape) return;

    if (selectedTool !== 'eraser') {
      const normalized = normalizeShapeSize(draftShape);

      // Replace draft shape with its normalized form by ID, not by position.
      setShapesAndRef(prev => {
        const idx = prev.findIndex(s => s.id === normalized.id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = normalized;
        return next;
      });

      const hasValidDimensions =
        Math.abs(normalized.width ?? 0) > 5 ||
        Math.abs(normalized.height ?? 0) > 5 ||
        ((normalized.points ?? []).length > 4);

      if (hasValidDimensions) {
        pushHistory({ action: 'add', shape: normalized });
        if (SingletonSocket.getInstance()?.connected) {
          SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: normalized });
        }
      } else {
        // remove tiny shape (too small to be meaningful — not tracked in history)
        setShapesAndRef(prev => prev.filter(s => s.id !== normalized.id));
      }
    } else {
      // eraser — individual shape deletions are tracked via onDeleteRequest
    }
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const zoomFactor = 1.05;
    const newScale = e.evt.deltaY > 0 ? oldScale / zoomFactor : oldScale * zoomFactor;
    const boundedScale = Math.max(0.1, Math.min(10, newScale));
    const newPos = {
      x: pointer.x - mousePointTo.x * boundedScale,
      y: pointer.y - mousePointTo.y * boundedScale
    };

    setViewPortTransform({ scale: boundedScale, x: newPos.x, y: newPos.y });
  };

  
const handleShapeChange = useCallback((updatedShape: Shape) => {
  // Capture the previous shape BEFORE mutating the array so undo can restore it.
  const previousShape = shapesRef.current.find(s => s.id === updatedShape.id);
  const normalized = normalizeShapeSize(updatedShape);
  setShapesAndRef(prev => prev.map(s => s.id === normalized.id ? normalized : s));
  pushHistory({ action: 'update', shape: normalized, previousShape });
  if (SingletonSocket.getInstance()?.connected) {
    SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: normalized });
  }
}, [params.fileId, collaborativeRole, pushHistory]); 

  const handleUndo = () => {
    if (historyStep < 0) return;
    const entry = history[historyStep];
    if (!entry) return;
    const newStep = historyStep - 1;
    historyStepRef.current = newStep;
    setHistoryStep(newStep);

    if (entry.action === 'add') {
      // Undo an add → remove the shape and tell collaborators.
      setShapesAndRef(prev => prev.filter(s => s.id !== entry.shape.id));
      if (SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:delete', { fileId: params.fileId, role: collaborativeRole, stroke: entry.shape.id });
      }
    } else if (entry.action === 'delete') {
      // Undo a delete → restore the shape and tell collaborators.
      setShapesAndRef(prev => [...prev, entry.shape]);
      if (SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: entry.shape });
      }
    } else if (entry.action === 'update') {
      // Undo an update → revert to the shape as it was before the edit.
      const reverted = entry.previousShape ?? entry.shape;
      setShapesAndRef(prev => prev.map(s => s.id === reverted.id ? reverted : s));
      if (SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: reverted });
      }
    }
  };

  const handleRedo = () => {
    if (historyStep >= history.length - 1) return;
    const newStep = historyStep + 1;
    const entry = history[newStep];
    if (!entry) return;
    historyStepRef.current = newStep;
    setHistoryStep(newStep);

    if (entry.action === 'add') {
      // Redo an add → put the shape back and tell collaborators.
      setShapesAndRef(prev => {
        const filtered = prev.filter(s => s.id !== entry.shape.id);
        return [...filtered, entry.shape];
      });
      if (SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: entry.shape });
      }
    } else if (entry.action === 'delete') {
      // Redo a delete → remove the shape and tell collaborators.
      setShapesAndRef(prev => prev.filter(s => s.id !== entry.shape.id));
      if (SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:delete', { fileId: params.fileId, role: collaborativeRole, stroke: entry.shape.id });
      }
    } else if (entry.action === 'update') {
      // Redo an update → re-apply the edited shape and tell collaborators.
      setShapesAndRef(prev => prev.map(s => s.id === entry.shape.id ? entry.shape : s));
      if (SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: entry.shape });
      }
    }
  };

  const handleClear = () => {
    const shapeIds = shapesRef.current.map(s => s.id);
    setShapesAndRef([]);
    // Clear wipes the entire canvas — also reset history so undo cannot
    // restore shapes that no longer exist on the server.
    setHistory([]);
    historyStepRef.current = -1;
    setHistoryStep(-1);
    if (SingletonSocket.getInstance()?.connected) {
      SingletonSocket.getInstance()?.emit('strokes:delete', { fileId: params.fileId, role: collaborativeRole, strokes: shapeIds });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading('Saving canvas...');
    try {
      const fileId = params.fileId as string;
      const token = session?.user?.token;
      if (!fileId || !token) throw new Error("Missing credentials");

      // prepare validated payload (normalize shapes before sending)
      const payloadShapes = shapesRef.current.map(s => {
        const ns = normalizeShapeSize(s);
        return {
          ...ns,
          // ensure backend names expected by prisma - use width/height
          width: ns.width,
          height: ns.height,
          points: ns.points ?? [],
        };
      });

      // Backend expects a delta payload, not a flat shapes array.
      // We send all current shapes as "updated" (upsert semantics).
      await axios.post(
        `${CANVAS_URL}/${fileId}`,
        { actions: { created: [], updated: payloadShapes, deleted: [] } },
        { headers: { Authorization: token } }
      );
      toast.success('Canvas saved!', { id: toastId });
    } catch (error) {
      console.error("Save failed:", error);
      toast.error('Failed to save canvas.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleColorChange = (color: string) => {
    setStrokeColor(color);
    if (selectedShapeId) {
      // Capture old shape before mutation so undo can restore the previous color.
      const previousShape = shapesRef.current.find(s => s.id === selectedShapeId);
      setShapesAndRef(prev =>
        prev.map(s => s.id === selectedShapeId ? normalizeShapeSize({ ...s, color }) : s)
      );
      const updatedShape = shapesRef.current.find(s => s.id === selectedShapeId);
      if (updatedShape) {
        pushHistory({ action: 'update', shape: updatedShape, previousShape });
        if (SingletonSocket.getInstance()?.connected) {
          SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: normalizeShapeSize(updatedShape) });
        }
      }
    }
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 z-50 gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 border-[3px] border-zinc-700 rounded-full" />
          <div className="absolute inset-0 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-zinc-400 text-sm font-medium animate-pulse">Loading canvas&hellip;</p>
      </div>
    );
  }

  const cursorStyle = selectedTool === 'hand' ? (isDrawing ? 'grabbing' : 'grab') : selectedTool === 'eraser' ? 'cell' : 'crosshair';
  const width = (typeof window !== 'undefined') ? window.innerWidth : 800;
  const height = (typeof window !== 'undefined') ? window.innerHeight : 600;

  return (
    <div className="fixed inset-0 bg-zinc-950 overflow-hidden select-none">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={viewPortTransform.scale}
        scaleY={viewPortTransform.scale}
        x={viewPortTransform.x}
        y={viewPortTransform.y}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        draggable={selectedTool === 'hand' && selectedShapeId === null}
        onDragStart={() => { if(selectedTool === 'hand' && selectedShapeId === null) setIsDrawing(true); }}
        onDragEnd={(e) => {
          if(selectedTool === 'hand' && selectedShapeId === null) {
            setViewPortTransform({ ...viewPortTransform, x: e.target.x(), y: e.target.y() });
            setIsDrawing(false);
          }
        }}
        style={{ cursor: cursorStyle, background: '#18181b' }}
      >
        {/* Layer 1 — committed shapes. Re-renders only when the shapes array changes. */}
        <Layer id="shapes">
          {shapes.map((shape) => (
            <ShapeRenderer
              key={shape.id}
              shape={shape}
              
              // --- Props for Visuals ---
              isSelected={shape.id === selectedShapeId}
              isLocked={!!lockedShapes[shape.id] && lockedShapes[shape.id] !== session?.user?.id}
              
              // --- Props for Tools ---
              isDrawing={isDrawing}
              selectedTool={selectedTool}
              
              // --- Prop for Changing the Shape ---
              onChange={handleShapeChange}
              
              isEditing={shape.id === editingTextId}
              onEditEnd={() => {
                setEditingTextId(null);
                // Also unlock shape when done editing
                if (shape.id) {
                  SingletonSocket.getInstance()?.emit("shape:unlock", {
                    fileId: params.fileId,
                    shapeId: shape.id,
                    userId: session?.user?.id
                  });
                }
              }}
              onEditStart={() => {
                SingletonSocket.getInstance()?.emit("shape:lock", {
                  fileId: params.fileId,
                  shapeId: shape.id,
                  userId: session?.user?.id
                });
                setEditingTextId(shape.id);
                setSelectedShapeId(shape.id);
              }}
              
              // 1. onSelectRequest (for locking)
              onSelectRequest={() => {
                if (!isAllowedToDraw() || selectedTool !== 'hand' || lockedShapes[shape.id]) {
                  return; // Not allowed, not hand tool, or already locked by someone
                }

                // If we're trying to select a *different* shape...
                if (selectedShapeId && selectedShapeId !== shape.id) {
                  // ...unlock the OLD one first.
                  SingletonSocket.getInstance()?.emit("shape:unlock", {
                    fileId: params.fileId,
                    shapeId: selectedShapeId,
                    userId: session?.user?.id
                  });
                }

                // Optimistically select the shape so the Transformer & draggable
                // activate instantly instead of waiting for the server roundtrip.
                setSelectedShapeId(shape.id);
                
                // Request the collaborative lock (server will confirm via shape:is-locked).
                SingletonSocket.getInstance()?.emit("shape:lock", {
                  fileId: params.fileId,
                  shapeId: shape.id,
                  userId: session?.user?.id
                });
              }}
              
              // 2. onDeleteRequest (for erasing)
              onDeleteRequest={() => {
                // This function is correct.
                if (isAllowedToDraw()) {
                  if (shape.id === editingTextId) {
                    setEditingTextId(null);
                  }
                  // Capture the full shape object before removal so undo can restore it.
                  const deletedShape = shapesRef.current.find(s => s.id === shape.id) ?? shape;
                  setShapesAndRef(prev => prev.filter(s => s.id !== shape.id));
                  pushHistory({ action: 'delete', shape: deletedShape });
                  if (SingletonSocket.getInstance()?.connected) {
                    SingletonSocket.getInstance()?.emit('stroke:delete', { fileId: params.fileId, role: collaborativeRole, stroke: shape.id });
                  }
                }
              }}
            />
          ))}

        </Layer>

        {/* Layer 2 — remote cursors. Only re-renders when cursor state changes,
            completely isolated from the shapes layer so drawing never triggers
            a cursor re-render and vice versa. */}
        <Layer id="cursors" listening={false}>
          {Object.entries(cursors).map(([id, cursor]) => {
            const pos = cursor?.position;
            const userName = cursor?.user?.name ?? 'Anonymous';

            if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
              return null;
            }

            return (
              <CursorRenderer
                key={id}
                x={pos.x}
                y={pos.y}
                name={userName}
              />
            );
          })}
        </Layer>
      </Stage>

      <CanvaToolbar
        selectedTool={selectedTool}
        undo={handleUndo}
        redo={handleRedo}
        save={handleSave}
        isSaving={isSaving}
        clear={handleClear}
        setSelectedTool={(tool) => {
          setSelectedTool(tool);
          setSelectedShapeId(null);
        }}
        setSelectedColor={handleColorChange}
        setFontSize={()=>{}}
        setFontFamily={()=>{}}
        isContentThere={shapesRef.current.length > 0}
      />
    </div>
  );
}
