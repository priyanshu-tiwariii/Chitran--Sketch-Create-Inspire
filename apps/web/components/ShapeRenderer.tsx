'use client';
import React, { useRef, useEffect, memo } from 'react';
import { Rect, Circle, Line, Arrow, Star, RegularPolygon, Transformer, Text } from 'react-konva';
import Konva from 'konva';
import { Shape } from '../types/shape.types';

type ShapeRendererProps = {
  shape: Shape;
  isSelected: boolean;
  isDrawing: boolean;
  selectedTool: string;
  isLocked: boolean;
  onSelectRequest: () => void;
  onDeleteRequest: () => void;
  onChange: (newAttrs: Shape) => void;
  isEditing: boolean;
  onEditEnd: () => void;
  onEditStart: () => void;
};

export const ShapeRenderer = memo(({
  shape, isSelected, isDrawing, selectedTool, isLocked,
  onSelectRequest, onDeleteRequest, onChange,
  isEditing, onEditEnd, onEditStart
}: ShapeRendererProps) => {

  const shapeRef = useRef<any>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // --- THIS IS THE NEW, EXCALIDRAW-STYLE useEffect ---
  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const textNode = shapeRef.current;
    if (!textNode) return;

    const stage = textNode.getStage();
    const container = stage.container();
    const layer = textNode.getLayer();

    // 1. Hide the Konva node
    textNode.hide();
    transformerRef.current?.hide();
    layer.batchDraw();

    // 2. Create <textarea>
    const textarea = document.createElement('textarea');
    // Append to container, not body. This is much more stable.
    container.appendChild(textarea);

    // 3. Set styles
    textarea.value = shape.text || '';
    textarea.style.position = 'absolute';
    textarea.style.border = 'none';
    textarea.style.padding = '0px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = textNode.lineHeight() || '1.2';
    textarea.style.fontFamily = shape.fontFamily || 'Arial';
    textarea.style.fontSize = `${shape.fontSize || 16}px`;
    textarea.style.color = shape.color;
    textarea.style.zIndex = '1000';
    
    // --- Auto-resize logic ---
    const MIN_WIDTH = 20;
    const MIN_HEIGHT = 20;

    const resizeTextarea = () => {
      // Reset height to auto to get the real scrollHeight
      textarea.style.height = 'auto';
      textarea.style.width = 'auto';

      const newWidth = Math.max(MIN_WIDTH, textarea.scrollWidth);
      const newHeight = Math.max(MIN_HEIGHT, textarea.scrollHeight);
      
      textarea.style.width = `${newWidth}px`;
      textarea.style.height = `${newHeight}px`;

      // Update the Konva shape in real-time
      const scale = stage.scaleX();
      onChange({
        ...shape,
        text: textarea.value,
        width: newWidth / scale,
        height: newHeight / scale
      });
    };

    // 4. Calculate position
    const positionTextarea = () => {
      const textPosition = textNode.absolutePosition();
      const scale = stage.scaleX();
      
      textarea.style.top = `${textPosition.y * scale}px`;
      textarea.style.left = `${textPosition.x * scale}px`;
      textarea.style.fontSize = `${(shape.fontSize || 16) * scale}px`;
      
      resizeTextarea();
    };

    positionTextarea();
    textarea.focus();
    textarea.select();

    // 5. Event Handlers
    const finishEditing = () => {
      if (!container.contains(textarea)) return;
      
      // Get final state
      const newText = textarea.value;
      const newWidth = parseFloat(textarea.style.width);
      const newHeight = parseFloat(textarea.style.height);
      const scale = stage.scaleX();

      // Clean up
      try { container.removeChild(textarea); } catch (e) {}
      window.removeEventListener('click', handleOutsideClick);
      
      textNode.show();
      layer.batchDraw();
      onEditEnd();

      // Final update
      if (newText.trim() === '') {
        onDeleteRequest(); // Delete if empty
      } else {
        onChange({
          ...shape,
          text: newText,
          width: newWidth / scale,
          height: newHeight / scale,
        });
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (e.target !== textarea) {
        finishEditing();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      }
      if (e.key === 'Escape') {
        finishEditing();
      }
    };

    textarea.addEventListener('input', resizeTextarea);
    textarea.addEventListener('keydown', handleKeyDown);
    textarea.addEventListener('blur', finishEditing);
    // Use timeout to prevent capture of the same click
    setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    });

    // Cleanup
    return () => {
      try { container.removeChild(textarea); } catch (e) {}
      window.removeEventListener('click', handleOutsideClick);
      textNode.show();
      layer.batchDraw();
    };

  }, [isEditing]);
  // --- END OF NEW useEffect ---


  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      // Don't show transformer while editing
      if (isEditing) {
         transformerRef.current.nodes([]);
      } else {
         transformerRef.current.nodes([shapeRef.current]);
      }
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, isEditing]); // Add isEditing
  
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    let newWidth = Math.max(5, (node.width() || 0) * scaleX);
    let newHeight = Math.max(5, (node.height() || 0) * scaleY);
    let newX = node.x();
    let newY = node.y();

    let newAttrs: Shape = { ...shape };

    switch (shape.type) {
      case 'line':
      case 'arrow':
        newAttrs = {
          ...shape, x: newX, y: newY,
          width: newWidth, height: newHeight,
          points: [0, 0, newWidth, newHeight],
          rotation: node.rotation(),
        };
        break;
      
      case 'rectangle':
      case 'pencil':
        newAttrs = {
          ...shape, x: newX, y: newY,
          width: newWidth, height: newHeight,
          rotation: node.rotation(),
        };
        break;
      
      case 'circle':
      case 'star':
      case 'triangle':
        newAttrs = {
          ...shape,
          x: newX - newWidth / 2, y: newY - newHeight / 2,
          width: newWidth, height: newHeight,
          radius: Math.min(Math.abs(newWidth), Math.abs(newHeight)) / 2,
          rotation: node.rotation(),
        };
        break;

      case 'text':
        // When resizing text, we adjust fontSize
        const newFontSize = Math.max(10, Math.round((shape.fontSize || 16) * scaleY));
        newAttrs = {
          ...shape,
          x: newX, y: newY,
          fontSize: newFontSize,
          width: newWidth,
          height: newHeight, 
          rotation: node.rotation(),
        };
        node.scaleX(1);
        node.scaleY(1);
        break;

      default:
        newAttrs = { ...shape, x: newX, y: newY };
    }
    
    onChange(newAttrs);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    let newX = node.x();
    let newY = node.y();
    const width = shape.width ?? 0;
    const height = shape.height ?? 0;

    switch (shape.type) {
      case 'line':
      case 'arrow':
      case 'rectangle':
      case 'pencil':
        break;
      
      case 'circle':
      case 'star':
      case 'triangle':
        newX = node.x() - width / 2; 
        newY = node.y() - height / 2;
        break;
    }
    
    onChange({ ...shape, x: newX, y: newY });
  };

  const commonProps = {
    id: shape.id,
    onClick: () => {
      if (selectedTool === 'hand') {
        onSelectRequest();
      } else if (selectedTool === 'eraser') {
        onDeleteRequest();
      }
    },
    onTap: () => { 
      if (selectedTool === 'hand') {
        onSelectRequest();
      } else if (selectedTool === 'eraser') {
        onDeleteRequest();
      }
    },
    onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (shape.type === 'text' && isSelected) {
        onEditStart(); 
      }
    },
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    draggable: isSelected,
    rotation: shape.rotation || 0,
    stroke: shape.color,
    strokeWidth: shape.strokeWidth,
    onMouseEnter: () => {
      if (isDrawing && selectedTool === 'eraser') {
        onDeleteRequest();
      }
    },
    opacity: isLocked ? 0.5 : 1, 
    listening: !isLocked,
  };

  const renderShape = () => {
    const width = shape.width ?? 0;
    const height = shape.height ?? 0;
    const x = shape.x ?? 0;
    const y = shape.y ?? 0;

    switch (shape.type) {
      case 'rectangle':
        return <Rect {...commonProps} ref={shapeRef} x={x} y={y} width={width} height={height} cornerRadius={10} />;
      
      case 'circle':
        return <Circle {...commonProps} ref={shapeRef} x={x + width / 2} y={y + height / 2} radius={Math.min(Math.abs(width), Math.abs(height)) / 2} />;
      
      case 'pencil':
        return <Line {...commonProps} ref={shapeRef} points={shape.points} x={x} y={y} tension={0.5} lineCap="round" lineJoin="round" hitStrokeWidth={20} />;
      
      case 'text':
        return <Text
          {...commonProps}
          ref={shapeRef}
          x={x}
          y={y}
          text={shape.text}
          fontSize={shape.fontSize}
          fontFamily={shape.fontFamily}
          fill={shape.color}
          stroke={undefined}
          strokeWidth={0}
          width={width || undefined}
          height={height || undefined}
          verticalAlign="top" // Important for layout
          wrap="word" // Allows wrapping
        />;
      
      case 'line':
        return <Line {...commonProps} ref={shapeRef} x={x} y={y} points={[0, 0, width, height]} lineCap="round" lineJoin="round" hitStrokeWidth={20} />;
      
      case 'arrow':
        return <Arrow {...commonProps} ref={shapeRef} x={x} y={y} points={[0, 0, width, height]} pointerLength={10} pointerWidth={10} hitStrokeWidth={20} />;
      
      case 'star':
        return <Star {...commonProps} ref={shapeRef} x={x + width / 2} y={y + height / 2} numPoints={5} outerRadius={Math.min(Math.abs(width), Math.abs(height)) / 2} innerRadius={Math.min(Math.abs(width), Math.abs(height)) / 4} />;
      
      case 'triangle':
        return <RegularPolygon {...commonProps} ref={shapeRef} x={x + width / 2} y={y + height / 2} sides={3} radius={Math.min(Math.abs(width), Math.abs(height)) / 2} />;
      
      default:
        return null;
    }
  };

  return (
    <>
      {renderShape()}
      {isSelected && (
        <Transformer
            ref={transformerRef}
            flipEnabled={false}
            enabledAnchors={
              shape.type === 'text' ? ['middle-left', 'middle-right'] // Only allow horizontal resize for text
              : shape.type === 'line' || shape.type === 'arrow' ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
              : undefined
            }
            rotateEnabled={shape.type !== 'text'}
            boundBoxFunc={(oldBox, newBox) => {
                if (shape.type === 'text') {
                  // For text, only allow width to change
                  newBox.height = oldBox.height;
                }
                if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                    return oldBox;
                }
                return newBox;
            }}
        />
      )}
      {isLocked && (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          stroke="#f00" 
          strokeWidth={2}
          dash={[4, 4]}
          listening={false}
          rotation={shape.rotation || 0}
        />
      )}
    </>
  );
});