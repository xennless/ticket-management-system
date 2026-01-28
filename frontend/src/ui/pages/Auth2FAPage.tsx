import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { FormField } from '../components/FormField';
import { Skeleton } from '../components/Skeleton';
import { Shield, QrCode, CheckCircle, XCircle, Key, Info, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';

type TwoFAStatus = {
  enabled: boolean;
  method: string | null;
};

export function Auth2FAPage() {
  const { has } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = has('auth.2fa.manage');
  const [selectedMethod, setSelectedMethod] = useState<'TOTP' | 'EMAIL'>('TOTP');
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const { data: status, isLoading } = useQuery<TwoFAStatus>({
    queryKey: ['auth', '2fa', 'status'],
    queryFn: () => apiFetch('/api/auth/2fa/status')
  });

  const isEnabled = status?.enabled ?? false;
  const currentMethod = status?.method;

  // Eğer 2FA aktifse ve farklı method seçilirse uyarı göster
  const handleMethodChange = (newMethod: 'TOTP' | 'EMAIL') => {
    if (isEnabled && currentMethod && currentMethod !== newMethod) {
      toast.push({ 
        type: 'info', 
        title: '2FA Zaten Aktif', 
        description: `Farklı bir yöntem seçmek için önce mevcut 2FA'yı (${currentMethod === 'TOTP' ? 'Authenticator' : 'Email'}) devre dışı bırakmalısınız.` 
      });
      return;
    }
    setSelectedMethod(newMethod);
  };

  const enableM = useMutation({
    mutationFn: (method: 'TOTP' | 'EMAIL') => apiFetch<{ method: string; qrCode?: string; secret?: string; manualEntryKey?: string; message?: string }>('/api/auth/2fa/enable', { 
      method: 'POST',
      json: { method }
    }),
    onSuccess: (data) => {
      if (data.method === 'TOTP' && data.qrCode) {
        setQrCode(data.qrCode); // QR kod data URL olarak gelir
        toast.push({ type: 'info', title: 'QR kodu oluşturuldu', description: 'Lütfen kodunuzu doğrulayın' });
      } else if (data.method === 'EMAIL') {
        toast.push({ type: 'info', title: 'Email yöntemi seçildi', description: data.message || 'Doğrulama kodları email ile gönderilecek' });
      }
    },
    onError: () => {
      // Hata durumunda state'i temizle
      setQrCode(null);
      setVerificationCode('');
    }
  });

  const verifyM = useMutation({
    mutationFn: (code: string) => apiFetch<{ success: boolean; backupCodes: string[] }>('/api/auth/2fa/verify', { method: 'POST', json: { code } }),
    onSuccess: (data) => {
      setVerificationCode('');
      setQrCode(null);
      
      // Method kontrolü - EMAIL için yedek kod yok
      if (enableM.data?.method === 'EMAIL' || (data.backupCodes && data.backupCodes.length === 0)) {
        // EMAIL method - direkt aktifleştir, yedek kod yok
        qc.invalidateQueries({ queryKey: ['auth', '2fa', 'status'] });
        toast.push({ type: 'success', title: '2FA başarıyla aktifleştirildi', description: 'Email yöntemi aktif. Giriş sırasında kodlar email ile gönderilecek.' });
        enableM.reset();
      } else {
        // TOTP method - yedek kodları göster
        setBackupCodes(data.backupCodes);
        setShowBackupCodes(true);
        toast.push({ type: 'success', title: '2FA başarıyla aktifleştirildi', description: 'Lütfen yedek kodlarınızı kaydedin' });
      }
    },
    onError: () => {
      toast.push({ type: 'error', title: 'Geçersiz kod' });
    }
  });

  const disableM = useMutation({
    mutationFn: (data: { password: string }) => 
      apiFetch('/api/auth/2fa/disable', { method: 'POST', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', '2fa', 'status'] });
      toast.push({ type: 'success', title: '2FA devre dışı bırakıldı' });
      setShowDisableModal(false);
      setDisablePassword('');
    },
    onError: (err: any) => {
      toast.push({ type: 'error', title: err?.message || '2FA devre dışı bırakılamadı' });
    }
  });

  // Not: backupCodesQ ve regenerateBackupCodesM şu anda kullanılmıyor
  // Yedek kodlar enable sırasında backend'den geliyor

  if (!canManage) {
    return <div className="p-6 text-center text-slate-500">2FA yönetimi yetkiniz yok.</div>;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="İki Faktörlü Kimlik Doğrulama (2FA)" 
        description="Hesabınızın güvenliğini artırın"
        actions={
          <Button variant="secondary" onClick={() => setShowInfoModal(true)}>
            <Info className="w-4 h-4 mr-2" />
            Bilgi
          </Button>
        }
      />

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Durum</h2>
        </div>

        <div className="flex items-center gap-3 mb-6">
          {isEnabled ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <span className="text-green-700 font-medium">2FA Aktif</span>
                {currentMethod && (
                  <span className="ml-2 text-sm text-slate-600">
                    ({currentMethod === 'TOTP' ? 'Authenticator Uygulaması' : 'Email'})
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">2FA Devre Dışı</span>
            </>
          )}
        </div>

        {!isEnabled && !qrCode && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">2FA Yöntemi Seçin</label>
              <p className="text-xs text-slate-500 mb-3">Sadece bir yöntem seçebilirsiniz. Seçtiğiniz yöntem aktifleştirildikten sonra değiştirmek için önce mevcut 2FA'yı devre dışı bırakmanız gerekir.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleMethodChange('TOTP')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedMethod === 'TOTP'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <QrCode className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <div className="font-medium text-slate-900">Authenticator Uygulaması</div>
                  <div className="text-xs text-slate-600 mt-1">Google Authenticator, Authy vb.</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodChange('EMAIL')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedMethod === 'EMAIL'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Shield className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <div className="font-medium text-slate-900">Email</div>
                  <div className="text-xs text-slate-600 mt-1">Kodlar email ile gönderilir</div>
                </button>
              </div>
            </div>
            <Button onClick={() => enableM.mutate(selectedMethod)} disabled={enableM.isPending}>
              <QrCode className="w-4 h-4 mr-2" />
              2FA Aktifleştir ({selectedMethod === 'TOTP' ? 'Authenticator' : 'Email'})
            </Button>
          </div>
        )}

        {qrCode && enableM.data && enableM.data.method === 'TOTP' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-4 text-center">QR kodu mobil uygulamanızla tarayın:</p>
              <div className="flex justify-center mb-4">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 border-2 border-slate-200 rounded-lg bg-white p-2" />
              </div>
              <p className="text-sm text-slate-600 mb-2">Veya aşağıdaki kodu manuel olarak girin:</p>
              <div className="font-mono text-xs bg-white text-slate-900 p-2 rounded border border-slate-200 break-all text-center">
                {enableM.data.manualEntryKey || enableM.data.secret}
              </div>
            </div>

            <FormField label="2FA Kodu" hint="Authenticator uygulamanızdan aldığınız 2FA kodunu girin">
              <Input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
              />
            </FormField>

            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={() => { 
                  setQrCode(null); 
                  setVerificationCode('');
                  enableM.reset(); // Mutation state'ini sıfırla
                }}
              >
                İptal
              </Button>
              <Button
                onClick={() => verifyM.mutate(verificationCode)}
                disabled={verificationCode.length !== 6 || verifyM.isPending}
              >
                Doğrula ve Aktifleştir
              </Button>
            </div>
          </div>
        )}

        {enableM.data && enableM.data.method === 'EMAIL' && !isEnabled && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">
                Email yöntemi seçildi. Doğrulama kodları giriş sırasında email ile gönderilecektir.
              </p>
              <p className="text-sm text-blue-700">
                Email yöntemi için ek doğrulama adımı gerekmez. Direkt aktifleştirilebilir.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={() => { 
                  enableM.reset(); // Mutation state'ini sıfırla
                }}
              >
                İptal
              </Button>
              <Button
                onClick={() => verifyM.mutate('000000')} // EMAIL için kod gerekmez
                disabled={verifyM.isPending}
              >
                Aktifleştir
              </Button>
            </div>
          </div>
        )}

        {/* Yedek kodları aktifleştirme sonrası göster */}
        {showBackupCodes && backupCodes.length > 0 && (
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-amber-900">Yedek Kodlar</span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const codesText = backupCodes.join('\n');
                  try {
                    await navigator.clipboard.writeText(codesText);
                    setBackupCodesCopied(true);
                    toast.push({ type: 'success', title: 'Kodlar kopyalandı', description: 'Tüm yedek kodlar panoya kopyalandı' });
                    setTimeout(() => setBackupCodesCopied(false), 2000);
                  } catch (err) {
                    // Fallback: textarea kullan
                    const textarea = document.createElement('textarea');
                    textarea.value = codesText;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                      document.execCommand('copy');
                      setBackupCodesCopied(true);
                      toast.push({ type: 'success', title: 'Kodlar kopyalandı', description: 'Tüm yedek kodlar panoya kopyalandı' });
                      setTimeout(() => setBackupCodesCopied(false), 2000);
                    } catch (e) {
                      toast.push({ type: 'error', title: 'Kopyalama başarısız', description: 'Lütfen kodları manuel olarak kopyalayın' });
                    }
                    document.body.removeChild(textarea);
                  }
                }}
              >
                {backupCodesCopied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Kodları Kaydet
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-amber-700 mb-3">
              <strong>Önemli:</strong> Bu kodları güvenli bir yerde saklayın. Her kod sadece bir kez kullanılabilir. 
              Mobil cihazınıza erişemediğinizde bu kodları kullanabilirsiniz.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {backupCodes.map((code, i) => (
                <div key={i} className="font-mono text-sm bg-white text-slate-900 p-2 rounded border border-slate-200 text-center">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-amber-200">
              <Button
                variant="primary"
                onClick={() => {
                  setShowBackupCodes(false);
                  setBackupCodes([]);
                  // Şimdi status'u güncelle
                  qc.invalidateQueries({ queryKey: ['auth', '2fa', 'status'] });
                  enableM.reset();
                }}
              >
                Tamam, Kaydettim
              </Button>
            </div>
          </div>
        )}

        {isEnabled && !qrCode && (
          <div className="mt-6 space-y-4">
            
            <Button variant="danger" onClick={() => setShowDisableModal(true)} className="w-full">
              <XCircle className="w-4 h-4 mr-2" />
              2FA Devre Dışı Bırak
            </Button>
          </div>
        )}
      </Card>

      {/* Info Modal */}
      {showInfoModal && (
        <Modal title="2FA Hakkında" open={showInfoModal} onClose={() => setShowInfoModal(false)}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                2FA Nedir?
              </h3>
              <p className="text-sm text-blue-800">
                İki Faktörlü Kimlik Doğrulama (2FA), hesabınızın güvenliğini artırmak için kullanılan bir güvenlik yöntemidir. Şifrenize ek olarak, mobil uygulamanızdan alacağınız bir kod ile giriş yaparsınız.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 text-sm">Özellikler:</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">QR Kod ile Aktifleştirme</p>
                    <p className="text-sm text-slate-600">2FA'yı aktifleştirmek için bir QR kod oluşturulur. Bu kodu Google Authenticator veya benzeri bir uygulama ile tarayarak hesabınızı bağlayabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">2FA Kodu</p>
                    <p className="text-sm text-slate-600">Aktifleştirme sonrası, her girişte mobil uygulamanızdan veya email'inizden alacağınız 2FA kodunu girmeniz gerekir.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Yedek Kodlar</p>
                    <p className="text-sm text-slate-600">2FA aktifleştirildiğinde yedek kodlar oluşturulur. Bu kodları güvenli bir yerde saklayın, mobil cihazınıza erişemediğinizde kullanabilirsiniz.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600">4</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Güvenlik</p>
                    <p className="text-sm text-slate-600">2FA aktif olduğunda, şifreniz çalınsa bile hesabınıza erişim sağlanamaz. Bu sayede hesabınız çok daha güvenli hale gelir.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Disable 2FA Modal */}
      <Modal 
        title="2FA'yı Devre Dışı Bırak" 
        open={showDisableModal} 
        onClose={() => {
          setShowDisableModal(false);
          setDisablePassword('');
        }}
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Uyarı:</strong> 2FA'yı devre dışı bırakmak hesabınızın güvenliğini azaltır. Bu işlemi geri alamazsınız.
            </p>
          </div>

          <FormField label="Şifre" hint="Hesabınızın şifresini girin">
            <Input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Şifrenizi girin"
            />
          </FormField>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowDisableModal(false);
                setDisablePassword('');
              }}
              className="flex-1"
            >
              İptal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!disablePassword.trim()) {
                  toast.push({ type: 'error', title: 'Şifre gereklidir' });
                  return;
                }
                disableM.mutate({ 
                  password: disablePassword
                });
              }}
              disabled={disableM.isPending || !disablePassword.trim()}
              className="flex-1"
            >
              {disableM.isPending ? 'Devre Dışı Bırakılıyor...' : 'Devre Dışı Bırak'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

