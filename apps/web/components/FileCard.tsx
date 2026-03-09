'use client';

import { Files, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface FileCardProps {
  file: {
    id: string;
    name: string;
    createdAt: string;
    isSaving?: boolean;
  };
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
}

export const FileCard = ({ file, onDelete, onClick }: FileCardProps) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleCardClick = () => {
    if (!file.isSaving && !isOpening) {
      setIsOpening(true);
      onClick?.(file.id);
    }
  };

  return (
    <div
      className={`relative group p-4 sm:p-5 rounded-2xl border bg-white transition-all overflow-hidden z-0 ${
        isOpening
          ? 'border-orange-300 shadow-md shadow-orange-100 scale-[0.98]'
          : 'hover:shadow-md hover:-translate-y-[2px]'
      }`}
    >
      {/* Icon and File Info */}
      <div className="flex items-center gap-4">
        <div className={`p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-[#ff9966] to-[#ff5e62] text-white shadow-sm transition-all ${isOpening ? 'animate-pulse' : ''}`}>
          {isOpening ? <Loader2 size={22} className="animate-spin" /> : <Files size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{file.name}</h3>
          <p className="text-xs sm:text-sm text-[#ff7753] mt-0.5">
            {new Date(file.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Saving badge */}
        {file.isSaving && (
          <div className="absolute top-2 right-3 text-xs text-orange-500 animate-pulse font-medium z-10">
            Saving...
          </div>
        )}

        {/* Opening badge */}
        {isOpening && (
          <div className="absolute top-2 right-3 text-xs text-orange-500 font-medium z-10 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />
            Opening...
          </div>
        )}
      </div>

      {/* Delete Button */}
      {!isOpening && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(file.id);
          }}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#fff0ee] hover:bg-[#ffe0db] text-[#ff5e4f] p-1.5 rounded-md"
          title="Delete file"
        >
          <Trash2 size={18} />
        </button>
      )}

      {/* Click Overlay */}
      <div
        onClick={handleCardClick}
        className={`absolute inset-0 z-0 ${isOpening ? 'pointer-events-none' : 'cursor-pointer'}`}
        title="Open file"
      />
    </div>
  );
};
