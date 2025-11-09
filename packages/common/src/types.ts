
export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'text' | 'pencil' | 'eraser' | 'hand' | 'star' | 'triangle';

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
 width?: number;
  height?: number;
   strokeWidth?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color: string;
  points?: number[] 
  rotation?: number;
};

 
