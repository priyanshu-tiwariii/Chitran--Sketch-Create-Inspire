import { X, FilePlus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface FileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (fileName: string) => void;
}

export const FileModal = ({ isOpen, onClose, onCreate }: FileModalProps) => {
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFileName('');
      // Auto-focus the input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!fileName.trim()) return;
    onCreate(fileName.trim());
    setFileName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in-0 zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#ff9966] to-[#ff5e62] text-white">
            <FilePlus size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Canvas</h2>
            <p className="text-xs text-gray-500">Give your canvas a name to get started</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="text"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-5 outline-none focus:ring-2 focus:ring-[#ff7753]/40 focus:border-[#ff7753] text-sm transition placeholder:text-gray-400"
          placeholder="e.g. Sprint Planning Board"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!fileName.trim()}
            className="bg-[#ff7753] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#e95e3f] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
