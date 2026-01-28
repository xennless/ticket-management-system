import { useState, useMemo, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Link } from 'lucide-react';
import clsx from 'clsx';

type IconPickerProps = {
  value: string;
  onChange: (iconName: string) => void;
  iconOptions?: string[]; // Eğer belirtilirse sadece bunlar gösterilir
  iconMap?: Record<string, string>; // Key -> Icon Name mapping
  label?: string;
  className?: string;
};

// Icon type definition
type IconEntry = {
  name: string;
  component: React.ComponentType<any>;
  library: string;
};

// Lucide React'ten tüm icon'ları yükle
// Vite'ın tree-shaking'ini bypass etmek için dinamik import kullanıyoruz
async function loadLucideIcons(): Promise<IconEntry[]> {
  try {
    // Dynamic import ile Vite'ın tree-shaking'ini bypass et
    const LucideModule = await import('lucide-react');
    const LucideIconsAll = LucideModule as any;
    
    // Önce Object.keys deneyelim
    let iconKeys = Object.keys(LucideIconsAll);
    
    // Eğer boşsa Object.getOwnPropertyNames kullan
    if (iconKeys.length === 0 || iconKeys.length < 100) {
      iconKeys = Object.getOwnPropertyNames(LucideIconsAll);
    }
    
    const excludedKeys = new Set([
      'createLucideIcon',
      'Icon',
      'lucideReact',
      'default',
      '__esModule',
      'LucideReact'
    ]);
    
    const processedIcons = new Map<string, IconEntry>();
    
    // İlk geçiş: Tüm ikon key'lerini topla
    const iconKeysMap = new Map<string, string>(); // baseName -> originalKey
    
    iconKeys.forEach((key) => {
      // Hariç tutulan anahtarları filtrele
      if (excludedKeys.has(key)) return;
      
      // Büyük harfle başlamayanları filtrele (ikon isimleri büyük harfle başlar)
      if (key.length === 0 || key[0] !== key[0].toUpperCase()) return;
      
      // Symbol'leri filtrele
      if (typeof key === 'symbol') return;
      
      // Değeri al - try/catch ile güvenli al
      let item;
      try {
        item = LucideIconsAll[key];
      } catch (e) {
        return; // Eğer alınamazsa atla
      }
      
      // İkon olup olmadığını kontrol et
      if (!item) return;
      
      // "Icon" ile biten isimleri base name'e çevir
      let baseName = key;
      if (key.endsWith('Icon')) {
        baseName = key.slice(0, -4); // "Icon" kısmını kaldır
      }
      
      // BaseName için key yönetimi:
      // - Eğer henüz key yoksa, direkt kaydet
      // - Eğer key varsa:
      //   - Mevcut key "Icon" ile bitiyorsa VE yeni key "Icon" ile bitmiyorsa -> Yeni key'i kaydet (base name'i tercih et)
      //   - Mevcut key "Icon" ile bitmiyorsa -> Mevcut key'i koru (base name öncelikli)
      //   - Her ikisi de "Icon" ile bitiyorsa -> İlk geleni koru
      const existingKey = iconKeysMap.get(baseName);
      if (!existingKey) {
        iconKeysMap.set(baseName, key);
      } else if (existingKey.endsWith('Icon') && !key.endsWith('Icon')) {
        // Mevcut key "Icon" ile bitiyor, yeni key bitmiyor -> Yeni key'i kaydet (base name tercih edilir)
        iconKeysMap.set(baseName, key);
      }
      // Diğer durumlarda mevcut key'i koru (override etme)
    });
    
    // İkinci geçiş: İkonları oluştur
    iconKeysMap.forEach((originalKey, baseName) => {
      let item;
      try {
        item = LucideIconsAll[originalKey];
      } catch (e) {
        return;
      }
      
      // Item geçerli olmalı (null/undefined değil)
      if (!item) return;
      
      // Lucide React ikonları bazı build araçları ile object olarak görünebilir
      // Ancak lucide-react'ten geldiği ve key pattern'e uyduğu için güvenli kabul ediyoruz
      // Function veya object (React component wrapper) olabilir
      // React render ederken geçersiz component'leri handle edecektir
      if (typeof item === 'function' || (typeof item === 'object' && item !== null)) {
        // Component'i direkt kullan
        processedIcons.set(baseName, {
          name: baseName,
          component: item as React.ComponentType<any>,
          library: 'Lucide'
        });
      }
    });
    
    const icons = Array.from(processedIcons.values())
      .filter((icon) => icon.component) // Geçerli component olanları filtrele
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return icons;
  } catch (error) {
    return [];
  }
}

// Cache for loaded icons
let cachedIcons: IconEntry[] | null = null;

export function IconPicker({ value, onChange, iconOptions, iconMap, label, className }: IconPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [allIcons, setAllIcons] = useState<IconEntry[]>(cachedIcons || []);
  
  // İkonları yükle (ilk render'da veya cache yoksa)
  useEffect(() => {
    if (!cachedIcons || cachedIcons.length === 0) {
      loadLucideIcons().then((icons) => {
        if (icons.length > 0) {
          cachedIcons = icons;
          setAllIcons(icons);
        }
      }).catch(() => {
        // Hata durumunda sessizce devam et
      });
    } else {
      setAllIcons(cachedIcons);
    }
  }, []);

  // Icon mapping kullanılıyorsa, value'yü icon adına çevir
  const getIconName = (iconKey: string): string => {
    if (iconMap && iconMap[iconKey]) {
      // IconMap'ten gelen değer zaten Lucide icon adı olmalı
      return iconMap[iconKey];
    }
    // Eğer key zaten büyük harfle başlıyorsa (Lucide formatı) direkt kullan
    if (iconKey && iconKey[0] === iconKey[0].toUpperCase()) {
      return iconKey;
    }
    // Küçük harfle başlıyorsa capitalize et (örn: 'shield' -> 'Shield')
    return iconKey ? iconKey.charAt(0).toUpperCase() + iconKey.slice(1) : 'Link';
  };

  const iconName = getIconName(value || '');
  
  // Seçili ikonu bul
  const selectedIconEntry = allIcons.find((icon) => {
    // Direkt eşleşme
    if (icon.name === iconName) return true;
    // IconMap üzerinden eşleşme
    if (iconMap && value) {
      const mappedName = iconMap[value];
      if (mappedName === icon.name) return true;
    }
    return false;
  });
  
  const SelectedIcon = selectedIconEntry?.component || Link;

  // Eğer iconOptions belirtilmişse, sadece onları kullan
  const availableIcons = iconOptions 
    ? allIcons.filter((icon) => {
        // iconOptions içindeki her bir seçenek için eşleşen ikonları bul
        return iconOptions.some((opt) => {
          // IconMap kullanılıyorsa, opt'u Lucide icon adına çevir
          if (iconMap && iconMap[opt]) {
            return icon.name === iconMap[opt];
          }
          // Direkt eşleşme veya capitalize edilmiş eşleşme
          return icon.name === opt || 
                 icon.name === opt.charAt(0).toUpperCase() + opt.slice(1) ||
                 icon.name.toLowerCase() === opt.toLowerCase();
        });
      })
    : allIcons;
  
  const filteredIcons = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return availableIcons;
    return availableIcons.filter((icon) => {
      const iconName = icon.name.toLowerCase();
      // Normal arama: ikon adında arama terimi geçiyor mu?
      if (iconName.includes(needle) || icon.library.toLowerCase().includes(needle)) {
        return true;
      }
      // İkon adı "Icon" ile bitiyorsa, "Icon" olmadan da eşleştir
      // Örn: "mail" arandığında "MailIcon" ikonu da bulunmalı
      const iconNameWithoutSuffix = iconName.endsWith('icon') 
        ? iconName.slice(0, -4) 
        : iconName;
      if (iconNameWithoutSuffix.includes(needle)) {
        return true;
      }
      // Tersine: arama terimi ikon adının bir parçası olabilir
      // Örn: "mail" -> "Mail", "MailIcon", "MailOpen", "Mails", vb.
      return false;
    });
  }, [availableIcons, search]);

  return (
    <div className={clsx('relative', className)}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      
      {/* Seçili İkon Göstergesi */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      >
        <SelectedIcon className="w-5 h-5 text-slate-600 flex-shrink-0" />
        <span className="flex-1 text-left text-slate-900">{value || 'İkon seçin'}</span>
        <svg
          className={clsx('w-4 h-4 text-slate-400 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* İkon Seçim Modal/Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute z-20 mt-2 w-full min-w-[500px] rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/10 max-h-96 overflow-hidden flex flex-col">
            {/* Arama */}
            <div className="p-3 border-b border-slate-200">
              <input
                type="text"
                placeholder={`İkon ara... (${allIcons.length}+ ikon)`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 text-slate-900 focus:ring-2 focus:ring-slate-900/10"
                autoFocus
              />
            </div>

            {/* İkon Grid */}
            <div className="overflow-y-auto p-3">
              {filteredIcons.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  İkon bulunamadı
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {filteredIcons.map((iconEntry) => {
                    const IconComponent = iconEntry.component;
                    if (!IconComponent) return null;

                    // Seçili kontrolü
                    const isSelected = 
                      value === iconEntry.name ||
                      (iconMap && value && iconMap[value] === iconEntry.name) ||
                      iconEntry.name.toLowerCase() === value?.toLowerCase();

                    return (
                      <button
                        key={iconEntry.name}
                        type="button"
                        onClick={() => {
                          // Eğer iconMap varsa, Lucide icon adını orijinal key'e çevir
                          const mappedValue = iconMap 
                            ? Object.keys(iconMap).find(k => iconMap[k] === iconEntry.name) || iconEntry.name
                            : iconEntry.name;
                          onChange(mappedValue);
                          setIsOpen(false);
                          setSearch('');
                        }}
                        className={clsx(
                          'flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border transition-colors min-w-0',
                          isSelected
                            ? 'border-slate-900 bg-slate-50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        )}
                        title={`${iconEntry.name} (${iconEntry.library})`}
                      >
                        <IconComponent className="w-5 h-5 flex-shrink-0" />
                        <span className="text-[10px] leading-tight text-center break-words max-w-full px-1">
                          {iconEntry.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-slate-200 text-xs text-slate-500 text-center">
              {filteredIcons.length} ikon gösteriliyor (Toplam: {allIcons.length} ikon)
            </div>
          </div>
        </>
      )}
    </div>
  );
}
