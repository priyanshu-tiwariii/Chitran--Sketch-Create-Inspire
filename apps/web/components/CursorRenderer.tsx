'use client';
import React from 'react';
import { Group, Path, Label, Tag, Text } from 'react-konva';

type CursorRendererProps = {
  x: number;
  y: number;
  name: string;
};

// SVG path for a standard cursor
const CURSOR_PATH = 'M0 0L11.598 12.254L7.171 13.111L10.396 19.539L8.038 20.889L4.813 14.461L0 16.974V0Z';

export const CursorRenderer = ({ x, y, name }: CursorRendererProps) => {
  return (
    <Group x={x} y={y} listening={false}>
      {/* The cursor shape */}
      <Path data={CURSOR_PATH} fill="#09f" stroke="#fff" strokeWidth={1} />
      
      {/* The name label */}
      <Label x={14} y={14} opacity={0.75}>
        <Tag
          fill="#09f"
          pointerDirection="left"
          pointerWidth={4}
          pointerHeight={5}
          lineJoin="round"
          cornerRadius={4}
        />
        <Text
          text={name}
          fontFamily="Arial"
          fontSize={12}
          padding={4}
          fill="#fff"
        />
      </Label>
    </Group>
  );
};