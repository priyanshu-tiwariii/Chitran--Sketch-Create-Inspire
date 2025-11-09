'use client';
import React, { useRef, useEffect, memo } from 'react';
import { Rect, Circle, Line, Arrow, Star, RegularPolygon, Transformer } from 'react-konva';
import Konva from 'konva';
import { Shape } from '../types/shape.types';

type ShapeRendererProps = {
  shape: Shape;
  isSelected: boolean;
  isDrawing: boolean;
  selectedTool: string;
  onSelect: (isDblClick?: boolean) => void;
  onChange: (newAttrs: Shape) => void;
};

export const ShapeRenderer = memo(({ shape, isSelected, isDrawing, selectedTool,  onSelect, onChange }: ShapeRendererProps) => {
  const shapeRef = useRef<any>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);
  
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
        ...shape,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        points: [0, 0, newWidth, newHeight],
        rotation: node.rotation(),
      };
      break;
    
    case 'rectangle':
    case 'pencil':
      newAttrs = {
        ...shape,
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
        rotation: node.rotation(),
      };
      break;
    
    case 'circle':
    case 'star':
    case 'triangle':
      newAttrs = {
        ...shape,
        x: newX - newWidth / 2,  
        y: newY - newHeight / 2,  
        width: newWidth,
        height: newHeight,
        radius: Math.min(Math.abs(newWidth), Math.abs(newHeight)) / 2,
        rotation: node.rotation(),
      };
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
    onClick: () => onSelect(false),
    onTap: () => onSelect(false),
    onDblClick: () => onSelect(true), 
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    draggable: isSelected,
    rotation: shape.rotation || 0,
    stroke: shape.color,
    strokeWidth: shape.strokeWidth,
    onMouseEnter: () => {
      if (isDrawing && selectedTool === 'eraser') {
        onSelect(false);
      }
    },
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
        // Draws the circle to fit perfectly inside the width/height bounding box
        return <Circle {...commonProps} ref={shapeRef} x={x + width / 2} y={y + height / 2} radius={Math.min(Math.abs(width), Math.abs(height)) / 2} />;
      
      case 'pencil':
        // Pencil is the only one that uses the raw points array directly
        return <Line {...commonProps} ref={shapeRef} points={shape.points} x={x} y={y} tension={0.5} lineCap="round" lineJoin="round" hitStrokeWidth={20} />;
      
      case 'line':
        return <Line {...commonProps} ref={shapeRef} x={x} y={y} points={[0, 0, width, height]} lineCap="round" lineJoin="round" hitStrokeWidth={20} />;
      
      case 'arrow':
        return <Arrow {...commonProps} ref={shapeRef} x={x} y={y} points={[0, 0, width, height]} pointerLength={10} pointerWidth={10} hitStrokeWidth={20} />;
      
      case 'star':
        // Draws a star to fit perfectly inside the width/height bounding box
        return <Star {...commonProps} ref={shapeRef} x={x + width / 2} y={y + height / 2} numPoints={5} outerRadius={Math.min(Math.abs(width), Math.abs(height)) / 2} innerRadius={Math.min(Math.abs(width), Math.abs(height)) / 4} />;
      
      case 'triangle':
        // Draws a triangle to fit perfectly inside the width/height bounding box
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
            // Enable resizing for lines/arrows by only allowing corner resizing
            enabledAnchors={shape.type === 'line' || shape.type === 'arrow' ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : undefined}
            boundBoxFunc={(oldBox, newBox) => {
                if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                    return oldBox;
                }
                return newBox;
            }}
        />
      )}
    </>
  );
});