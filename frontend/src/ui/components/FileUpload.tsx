import { useState, useRef } from 'react';
import clsx from 'clsx';
import { Upload, X, File } from 'lucide-react';
import { Button } from './Button';

export function FileUpload({
  accept,
  multiple = false,
  onFilesChange,
  maxSize,
  className
}: {
  accept?: string;
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
  maxSize?: number; // bytes
  className?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    if (maxSize) {
      const validFiles = newFiles.filter((f) => f.size <= maxSize);
      if (validFiles.length !== newFiles.length) {
        alert(`Bazı dosyalar çok büyük (Max: ${(maxSize / 1024 / 1024).toFixed(2)} MB)`);
      }
      setFiles((prev) => (multiple ? [...prev, ...validFiles] : validFiles));
      onFilesChange(multiple ? [...files, ...validFiles] : validFiles);
    } else {
      setFiles((prev) => (multiple ? [...prev, ...newFiles] : newFiles));
      onFilesChange(multiple ? [...files, ...newFiles] : newFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  return (
    <div className={className}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
          className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center transition',
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        )}
      >
        <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-600 mb-2">
          Dosyaları buraya sürükleyin veya{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-blue-600 hover:underline"
          >
            dosya seçin
          </button>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <File className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                  <div className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </div>
                </div>
              </div>
              <Button variant="secondary" onClick={() => removeFile(index)} className="shrink-0 p-1 h-auto">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

