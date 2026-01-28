import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { X, Filter, Save } from 'lucide-react';

type FilterState = {
  status: string[];
  priority: string[];
  createdById: string[];
  assignedToId: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
  q: string;
};

type AdvancedFiltersProps = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onSave?: (name: string) => void;
  savedFilters?: Array<{ id: string; name: string; filters: FilterState }>;
  onLoadFilter?: (filters: FilterState) => void;
  users?: Array<{ id: string; name: string | null; email: string }>;
};

export function AdvancedFilters({
  filters,
  onChange,
  onSave,
  savedFilters = [],
  onLoadFilter,
  users = []
}: AdvancedFiltersProps) {
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({
      status: [],
      priority: [],
      createdById: [],
      assignedToId: [],
      dateFrom: null,
      dateTo: null,
      q: ''
    });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.createdById.length > 0 ||
    filters.assignedToId.length > 0 ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.q;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Gelişmiş Filtreler</h3>
        {hasActiveFilters && (
          <Button variant="secondary" onClick={clearFilters} className="flex items-center gap-2 text-xs">
            <X className="w-3 h-3" />
            Temizle
          </Button>
        )}
      </div>

      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Durum</label>
              <div className="space-y-2">
                {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('status', [...filters.status, s]);
                        } else {
                          updateFilter('status', filters.status.filter((st) => st !== s));
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">
                      {s === 'OPEN' ? 'Açık' : s === 'IN_PROGRESS' ? 'İşlemde' : s === 'RESOLVED' ? 'Çözüldü' : 'Kapalı'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Öncelik</label>
              <div className="space-y-2">
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <label key={p} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.priority.includes(p)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFilter('priority', [...filters.priority, p]);
                        } else {
                          updateFilter('priority', filters.priority.filter((pr) => pr !== p));
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">
                      {p === 'LOW' ? 'Düşük' : p === 'MEDIUM' ? 'Orta' : p === 'HIGH' ? 'Yüksek' : 'Acil'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Oluşturan</label>
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value && !filters.createdById.includes(e.target.value)) {
                    updateFilter('createdById', [...filters.createdById, e.target.value]);
                  }
                }}
                className="w-full"
              >
                <option value="">Kullanıcı seçin...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </Select>
              {filters.createdById.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {filters.createdById.map((uid) => {
                    const user = users.find((u) => u.id === uid);
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                      >
                        {user?.name || user?.email || uid}
                        <button
                          onClick={() => updateFilter('createdById', filters.createdById.filter((id) => id !== uid))}
                          className="hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Atanan</label>
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value && !filters.assignedToId.includes(e.target.value)) {
                    updateFilter('assignedToId', [...filters.assignedToId, e.target.value]);
                  }
                }}
                className="w-full"
              >
                <option value="">Kullanıcı seçin...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </Select>
              {filters.assignedToId.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {filters.assignedToId.map((uid) => {
                    const user = users.find((u) => u.id === uid);
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                      >
                        {user?.name || user?.email || uid}
                        <button
                          onClick={() => updateFilter('assignedToId', filters.assignedToId.filter((id) => id !== uid))}
                          className="hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç Tarihi</label>
              <Input
                type="date"
                value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
                onChange={(e) => updateFilter('dateFrom', e.target.value ? new Date(e.target.value) : null)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bitiş Tarihi</label>
              <Input
                type="date"
                value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
                onChange={(e) => updateFilter('dateTo', e.target.value ? new Date(e.target.value) : null)}
              />
            </div>
          </div>

          {savedFilters.length > 0 && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Kayıtlı Filtreler</label>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((sf) => (
                  <Button
                    key={sf.id}
                    variant="secondary"
                    onClick={() => onLoadFilter?.(sf.filters)}
                  >
                    {sf.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {onSave && (
            <div className="border-t pt-4">
              {showSaveDialog ? (
                <div className="flex gap-2">
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Filtre adı"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (saveName.trim()) {
                        onSave(saveName);
                        setSaveName('');
                        setShowSaveDialog(false);
                      }
                    }}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button variant="secondary" onClick={() => setShowSaveDialog(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setShowSaveDialog(true)}>
                  <Save className="w-4 h-4 mr-2" />
                  Filtreyi Kaydet
                </Button>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

