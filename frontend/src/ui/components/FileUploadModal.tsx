import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Upload, Paperclip, X, Image, FileText, File as FileIcon, Clipboard } from 'lucide-react';
import clsx from 'clsx';

interface FileUploadModalProps {
  open: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number; // bytes
  title?: string;
}

export function FileUploadModal({
  open,
  onClose,
  onFilesSelected,
  multiple = true,
  accept,
  maxSize = 50 * 1024 * 1024, // 50MB default
  title = 'Dosya Ekle'
}: FileUploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    if (file.type.includes('pdf') || file.type.includes('document')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <FileIcon className="w-5 h-5 text-slate-500" />;
  };

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `${file.name} dosyası çok büyük (max: ${formatFileSize(maxSize)})`;
    }
    return null;
  };

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      const err = validateFile(file);
      if (err) {
        errors.push(err);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      if (multiple) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
      } else {
        setSelectedFiles(validFiles.slice(0, 1));
      }
    }
  }, [multiple, maxSize]);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
    e.target.value = '';
  };

  // Ctrl+V paste handler - React event
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Okunabilir tarih-saat formatı: ekran-goruntusu_2025-01-13_14-30-45.png
          const now = new Date();
          const date = now.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('.').reverse().join('-');
          const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/:/g, '-');
          const extension = file.type.split('/')[1] || 'png';
          const namedFile = new File([file], `ekran-goruntusu_${date}_${time}.${extension}`, { type: file.type });
          files.push(namedFile);
        }
      }
    }

    if (files.length > 0) {
      addFiles(files);
      setPasteMessage(`${files.length} ekran görüntüsü eklendi`);
      setTimeout(() => setPasteMessage(null), 2000);
    }
  }, [addFiles]);

  // Focus container when modal opens
  useEffect(() => {
    if (open && containerRef.current) {
      containerRef.current.focus();
    }
  }, [open]);

  // Modal kapandığında state'i temizle
  useEffect(() => {
    if (!open) {
      setSelectedFiles([]);
      setError(null);
      setDragActive(false);
    }
  }, [open]);

  const handleSubmit = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div 
        ref={containerRef}
        tabIndex={0}
        onPaste={handlePaste}
        className="space-y-4 outline-none"
      >
        {/* Paste Message */}
        {pasteMessage && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-600 font-medium">{pasteMessage}</p>
          </div>
        )}

        {/* Drop Zone */}
        <div
          ref={dropZoneRef}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={handleFileInput}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-3">
            <div className={clsx(
              'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
              dragActive ? 'bg-blue-100' : 'bg-slate-100'
            )}>
              <Upload className={clsx(
                'w-7 h-7',
                dragActive ? 'text-blue-500' : 'text-slate-400'
              )} />
            </div>
            
            <div>
              <p className="text-sm font-medium text-slate-700">
                {dragActive ? 'Dosyaları buraya bırakın' : 'Dosya sürükleyin veya tıklayın'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                veya <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs">Ctrl+V</kbd> ile ekran görüntüsü yapıştırın
              </p>
            </div>
            
            <p className="text-xs text-slate-400">
              Maksimum dosya boyutu: {formatFileSize(maxSize)}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Seçilen Dosyalar ({selectedFiles.length})
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedFiles.length === 0}
          >
            <Paperclip className="w-4 h-4 mr-2" />
            {selectedFiles.length > 0
              ? `${selectedFiles.length} Dosya Ekle`
              : 'Dosya Ekle'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

