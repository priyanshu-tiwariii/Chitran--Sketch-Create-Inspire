'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
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


export default function CanvasPage() {
  // --- State Management ---
  const [shapes, _setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);



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

  // normalize negative width/height and map legacy fields
  const normalizeShapeSize = (shape: Shape): Shape => {
    const width = (shape as any).width ?? (shape as any).w ?? 0;
    const height = (shape as any).height ?? (shape as any).h ?? 0;
    let x = shape.x;
    let y = shape.y;
    let w = width;
    let h = height;

    if (w < 0) { x = x + w; w = Math.abs(w); }
    if (h < 0) { y = y + h; h = Math.abs(h); }

    // keep other props
    const normalized: Shape = {
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
    return normalized;
  };

  const normalizeIncoming = (s: any): Shape => {
    const shape: Shape = {
      id: s.id,
      type: s.type,
      x: s.x ?? 0,
      y: s.y ?? 0,
      width: s.width ?? s.w ?? 0,
      height: s.height ?? s.h ?? 0,
      strokeWidth: s.strokeWidth ?? 2,
      radius: s.radius ?? 0,
      text: s.text ?? '',
      fontSize: s.fontSize ?? 16,
      fontFamily: s.fontFamily ?? 'Arial',
      color: s.color ?? '#000000',
      points: s.points ?? [],
      rotation: s.rotation ?? 0,
    };
    return normalizeShapeSize(shape);
  };

  // --- History Management ---
  // use functional updates (avoids stale closures)
  const updateHistory = useCallback((newShapes: Shape[]) => {
    setHistory(prevHistory => {
      const truncated = prevHistory.slice(0, historyStep + 1);
      const next = [...truncated, newShapes];
      setHistoryStep(next.length - 1);
      return next;
    });
  }, [historyStep]);

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
        setHistory([initialShapes]);
        setHistoryStep(0);

        if (isCollabActive) {
          const socket = SingletonSocket.getInstance(token);
          if (socket) {
            if (!socket.connected) socket.connect();
            socket.on('connect', () => socket.emit("join-file", verifiedFileId, session?.user?.id, role));
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
        socket.off('connect'); 
        socket.off('stroke:create'); 
        socket.off('stroke:delete');
        socket.off('strokes:delete');
        socket.off('shape:is-locked');
        socket.off('shape:is-unlocked');
        socket.off('shape:lock-failed');
        socket.off('cursor:update');
        socket.off('cursor:leave');
        socket.emit("leave-file", fileId);
        socket.disconnect();
      }
    };
  }, [params.fileId, session?.user?.token, dispatch, router]);

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
      updateHistory(shapesRef.current);
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
      const newShape: Shape = {
        id: `${session?.user?.id}-${Date.now()}`,
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
      // A. Broadcast our cursor position (Always)
      SingletonSocket.getInstance()?.emit("cursor:move", {
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
      const last = prev[prev.length - 1];
      if (!last || !isDrawingRef.current) return prev;

      const updated = { ...last };
      const startX = updated.x;
      const startY = updated.y;

      if (updated.type === 'pencil') {
        updated.points = [...(updated.points ?? [0, 0]), pos.x - startX, pos.y - startY];
      } else {
        updated.width = pos.x - startX;
        updated.height = pos.y - startY;
      }

      return [...prev.slice(0, -1), updated];
    });
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current) return;
    setIsDrawing(false);

    if (selectedTool === 'hand' && selectedShapeId) {
      SingletonSocket.getInstance()?.emit("shape:unlock", {
        fileId: params.fileId,
        shapeId: selectedShapeId,
        userId: session?.user?.id
      });
      setSelectedShapeId(null); 
    }
  

    const currentShapes = shapesRef.current;
    if (currentShapes.length === 0) return;
    const lastShape = currentShapes[currentShapes.length - 1];
    if (!lastShape) return;

    

    if (selectedTool !== 'eraser') {
      const normalized = normalizeShapeSize(lastShape);

      // replace last shape with normalized one if changed
      setShapesAndRef(prev => {
        const prevLast = prev[prev.length - 1];
        const replaced = [...prev.slice(0, -1), normalized];
        return replaced;
      });

      const hasValidDimensions =
        Math.abs(normalized.width ?? 0) > 5 ||
        Math.abs(normalized.height ?? 0) > 5 ||
        ((normalized.points ?? []).length > 4);

      if (hasValidDimensions) {
        updateHistory(shapesRef.current);
        if (SingletonSocket.getInstance()?.connected) {
          SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: normalized });
        }
      } else {
        // remove tiny shape
        setShapesAndRef(prev => prev.slice(0, -1));
      }
    } else {
      // eraser
      updateHistory(shapesRef.current);
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
  setShapesAndRef(prev => prev.map(shape => shape.id === updatedShape.id ? normalizeShapeSize(updatedShape) : shape));
  updateHistory(shapesRef.current);
  if (SingletonSocket.getInstance()?.connected) {
    SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: normalizeShapeSize(updatedShape) });
  }
}, [params.fileId, collaborativeRole, updateHistory]); 

  const handleUndo = () => {
    if (historyStep <= 0) return;
    const newStep = historyStep - 1;
    setHistoryStep(newStep);
    const target = history[newStep] ?? [];
    setShapesAndRef(target);
  };

  const handleRedo = () => {
    if (historyStep >= history.length - 1) return;
    const newStep = historyStep + 1;
    setHistoryStep(newStep);
    const target = history[newStep] ?? [];
    setShapesAndRef(target);
  };

  const handleClear = () => {
    const shapeIds = shapesRef.current.map(s => s.id);
    setShapesAndRef([]);
    updateHistory([]);
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

      await axios.post(
        `${CANVAS_URL}/${fileId}`,
        { shapes: payloadShapes },
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
      setShapesAndRef(prev => {
        const newShapes = prev.map(shape => shape.id === selectedShapeId ? normalizeShapeSize({ ...shape, color }) : shape);
        return newShapes;
      });
      updateHistory(shapesRef.current);

      const updatedShape = shapesRef.current.find(s => s.id === selectedShapeId);
      if (updatedShape && SingletonSocket.getInstance()?.connected) {
        SingletonSocket.getInstance()?.emit('stroke:create', { fileId: params.fileId, role: collaborativeRole, stroke: normalizeShapeSize(updatedShape) });
      }
    }
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
      </div>
    );
  }

  const cursorStyle = selectedTool === 'hand' ? (isDrawing ? 'grabbing' : 'grab') : selectedTool === 'eraser' ? 'cell' : 'crosshair';
  const width = (typeof window !== 'undefined') ? window.innerWidth : 800;
  const height = (typeof window !== 'undefined') ? window.innerHeight : 600;

  return (
    <div>
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
        style={{ cursor: cursorStyle }}
      >
        <Layer>

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
                
                // Now, request the lock for the NEW one.
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
                  const newShapes = shapesRef.current.filter(s => s.id !== shape.id);
                  setShapesAndRef(newShapes);
                  updateHistory(newShapes);
                  if (SingletonSocket.getInstance()?.connected) {
                    SingletonSocket.getInstance()?.emit('stroke:delete', { fileId: params.fileId, role: collaborativeRole, stroke: shape.id });
                  }
                }
              }}
            />
          ))}

          {/* Cursors */}
           {Object.entries(cursors).map(([id, cursor]) => {
            // defensive checks in case we got a malformed cursor
            const pos = cursor?.position;
            const userName = cursor?.user?.name ?? 'Anonymous';

            if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
              // skip rendering invalid cursors (or optionally continue)
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
