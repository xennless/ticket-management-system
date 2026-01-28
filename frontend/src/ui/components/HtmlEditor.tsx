import { useState } from 'react';
import { Button } from './Button';
import { Code } from 'lucide-react';
import clsx from 'clsx';
import { Textarea } from './Textarea';

type HtmlEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variables?: Record<string, string>; // Değişkenler: { code: 'Kod açıklaması' }
  className?: string;
};

export function HtmlEditor({ value, onChange, placeholder, variables, className }: HtmlEditorProps) {
  const [showVariables, setShowVariables] = useState(false);

  const insertVariable = (varName: string) => {
    const textarea = document.querySelector('.html-editor-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = `{{${varName}}}`;
      const newValue = value.substring(0, start) + text + value.substring(end);
      onChange(newValue);
      // Cursor'ı değişkenden sonra konumlandır
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }, 0);
    }
    setShowVariables(false);
  };

  return (
    <div className={clsx('space-y-2', className)}>
      {/* HTML Kod Editörü */}
      <div className="border border-slate-200 rounded-lg bg-white min-h-[300px] shadow-sm">
        {/* Header */}
        <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700">HTML Kod Düzenleme</span>
          </div>
          {variables && Object.keys(variables).length > 0 && (
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowVariables(!showVariables)}
                title="Değişken ekle"
                className="px-3 py-1.5 text-xs"
              >
                <span className="text-xs">+ Değişken Ekle</span>
              </Button>
              {showVariables && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowVariables(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-20 min-w-[280px] max-h-60 overflow-y-auto">
                    <div className="p-3 bg-slate-50 border-b border-slate-200">
                      <div className="text-xs font-semibold text-slate-700">Kullanılabilir Değişkenler</div>
                      <div className="text-xs text-slate-500 mt-0.5">Değişkeni eklemek için tıklayın</div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {Object.entries(variables).map(([key, desc]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => insertVariable(key)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-900 group-hover:bg-slate-200 transition-colors">
                              {`{{${key}}}`}
                            </code>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="relative">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'HTML kodunuzu buraya yazın...\n\nÖrnek:\n<h1>Başlık</h1>\n<p>İçerik {{variableName}}</p>'}
            rows={15}
            className="html-editor-textarea font-mono text-sm border-0 rounded-none focus:ring-0 resize-none"
            style={{ 
              fontFamily: '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              letterSpacing: '0.01em',
              tabSize: 2,
              minHeight: '400px',
              padding: '16px',
              backgroundColor: '#fafafa',
              color: '#1e293b'
            }}
          />
          
          {/* Syntax highlighting overlay için basit renklendirme */}
          <style>{`
            .html-editor-textarea::selection {
              background-color: #dbeafe;
              color: #1e293b;
            }
            .html-editor-textarea::-webkit-scrollbar {
              width: 10px;
              height: 10px;
            }
            .html-editor-textarea::-webkit-scrollbar-track {
              background: #f1f5f9;
            }
            .html-editor-textarea::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 5px;
            }
            .html-editor-textarea::-webkit-scrollbar-thumb:hover {
              background: #94a3b8;
            }
          `}</style>
        </div>

        {/* Footer - Yardımcı bilgiler */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>💡 <strong>İpucu:</strong> Değişkenler için <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">{'{{variableName}}'}</code> formatını kullanın</span>
            </div>
            <div className="text-slate-500">
              {value.length} karakter
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
