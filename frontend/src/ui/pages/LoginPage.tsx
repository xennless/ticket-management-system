import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/errors';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { Lock, Mail, Shield, Key } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) return 'Email gereklidir';
    const emailRegex = /^[^\s@]+@[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Geçersiz email formatı';
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Zorunlu şifre değişikliği adımı mı?
    if (requiresPasswordChange) {
      if (!currentPassword.trim()) {
        setError('Mevcut şifre gereklidir');
        return;
      }
      if (!newPassword.trim() || newPassword.length < 8) {
        setError('Yeni şifre en az 8 karakter olmalıdır');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Yeni şifreler eşleşmiyor');
        return;
      }
      setLoading(true);
      try {
        const { apiFetch } = await import('../../lib/api');
        const result = await apiFetch<{ success: boolean; token?: string; user?: any }>('/api/auth/change-password-required', {
          method: 'POST',
          auth: false,
          json: {
            userId: userId!,
            tempToken: tempToken || undefined,
            currentPassword,
            newPassword
          }
        });
        if (result.success && result.token) {
          // Token'ı kaydet ve yönlendir
          const { setToken } = await import('../../lib/api');
          setToken(result.token);
          window.location.href = '/'; // Hard reload to refresh auth state
        }
      } catch (err: any) {
        // Backend'den gelen şifre politikası hatalarını göster
        if (err?.issues && Array.isArray(err.issues)) {
          const policyErrors = err.issues
            .filter((issue: any) => issue.path?.[0] === 'newPassword')
            .map((issue: any) => issue.message);
          if (policyErrors.length > 0) {
            setError(policyErrors.join(', '));
          } else {
            setError(getErrorMessage(err) || 'Şifre değiştirme başarısız');
          }
        } else {
          setError(getErrorMessage(err) || 'Şifre değiştirme başarısız');
        }
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // 2FA adımı mı?
    if (requiresTwoFactor) {
      if (!twoFactorCode.trim()) {
        setError('2FA kodu gereklidir');
        return;
      }
      if (twoFactorCode.length < 6 || (twoFactorCode.length > 6 && twoFactorCode.length !== 8)) {
        setError('2FA kodu geçersiz format');
        return;
      }
      setLoading(true);
      try {
        const result = await login(email, password, twoFactorCode, tempToken || undefined);
        if (result && 'success' in result) {
          nav('/', { replace: true });
        } else if (result && 'requiresPasswordChange' in result && result.requiresPasswordChange) {
          // 2FA sonrası zorunlu şifre değişikliği
          setRequiresPasswordChange(true);
          setRequiresTwoFactor(false);
          setTempToken(result.tempToken || null);
          setUserId(result.userId || null);
          setError(null);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err) || '2FA doğrulama başarısız');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Normal login
    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    if (!password.trim()) {
      setError('Şifre gereklidir');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result && 'requiresTwoFactor' in result && result.requiresTwoFactor) {
        // 2FA gerekli
        setRequiresTwoFactor(true);
        setTempToken(result.tempToken || null);
        setUserId(result.userId || null);
        setError(null);
      } else if (result && 'requiresPasswordChange' in result && result.requiresPasswordChange) {
        // Zorunlu şifre değişikliği gerekli
        setRequiresPasswordChange(true);
        setTempToken(result.tempToken || null);
        setUserId(result.userId || null);
        setError(null);
      } else if (result && 'success' in result) {
        nav('/', { replace: true });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Giriş başarısız. Email ve şifrenizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequiresTwoFactor(false);
    setTwoFactorCode('');
    setTempToken(null);
    setUserId(null);
    setError(null);
  };

  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <Card className="w-full max-w-md shadow-xl animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white mb-4 shadow-lg">
            {requiresPasswordChange ? (
              <Key className="w-8 h-8" />
            ) : requiresTwoFactor ? (
              <Shield className="w-8 h-8" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-2">
            {requiresPasswordChange 
              ? 'Şifre Değişikliği Zorunlu'
              : requiresTwoFactor 
                ? '2FA Doğrulama' 
                : 'Giriş Yap'}
          </div>
          <div className="text-sm text-slate-600">
            {requiresPasswordChange
              ? 'Güvenlik için şifrenizi değiştirmeniz gerekmektedir'
              : requiresTwoFactor
                ? 'Mobil uygulamanızdan aldığınız kodu girin'
                : 'Sisteme erişmek için giriş yapın'}
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleLogin}>
          {requiresPasswordChange ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-900">
                  <strong>Şifre değişikliği zorunlu</strong>
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Güvenlik nedeniyle şifrenizi değiştirmeniz gerekmektedir. Lütfen login ekranında kullandığınız mevcut şifrenizi ve yeni bir şifre girin. Yeni şifreniz en az 8 karakter olmalıdır.
                </p>
              </div>

              <FormField
                label="Mevcut Şifre"
                hint="Login ekranında kullandığınız şifre (giriş yaptığınız şifre)"
              >
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••"
                    className="pl-9"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </FormField>

              <FormField
                label="Yeni Şifre"
                hint="Şifre politikası gereksinimlerini karşılamalıdır"
              >
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••"
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
                {newPassword && <PasswordStrength password={newPassword} showErrors={true} />}
              </FormField>

              <FormField
                label="Yeni Şifre (Tekrar)"
                hint="Yeni şifrenizi tekrar girin"
              >
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••"
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </FormField>
            </>
          ) : !requiresTwoFactor ? (
            <>
              <FormField
                label="Email"
                error={emailError}
                hint="Kullanıcı email adresiniz"
              >
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                    }}
                    onBlur={() => setEmailError(validateEmail(email))}
                    placeholder="ornek@local.com"
                    className="pl-9"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </FormField>

              <FormField
                label="Şifre"
                hint="Hesap şifreniz"
              >
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </FormField>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>İki faktörlü doğrulama gerekli</strong>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Mobil uygulamanızdan (Google Authenticator, Authy, vb.) aldığınız 6 haneli kodu girin.
                  Veya yedek kodunuz varsa yedek kodunuzu girebilirsiniz.
                </p>
              </div>

              <FormField
                label="2FA Kodu"
                hint="2FA kodunuzu girin"
              >
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').substring(0, 8); // Sadece rakam, max 8 karakter
                      setTwoFactorCode(value);
                      setError(null);
                    }}
                    placeholder="000000 veya 00000000"
                    className="pl-9 text-center tracking-widest font-mono text-lg"
                    disabled={loading}
                    autoFocus
                    maxLength={8}
                  />
                </div>
              </FormField>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleBack}
                disabled={loading}
              >
                Geri
              </Button>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-fade-in">
              {error}
            </div>
          )}

          <Button 
            className="w-full" 
            type="submit" 
            disabled={
              loading || 
              (requiresPasswordChange && (!currentPassword.trim() || !newPassword.trim() || newPassword.length < 8 || newPassword !== confirmPassword)) ||
              (!requiresTwoFactor && !requiresPasswordChange && (!email.trim() || !password.trim())) ||
              (requiresTwoFactor && !twoFactorCode.trim())
            }
          >
            {loading 
              ? (requiresPasswordChange ? 'Değiştiriliyor…' : requiresTwoFactor ? 'Doğrulanıyor…' : 'Giriş yapılıyor…') 
              : (requiresPasswordChange ? 'Şifreyi Değiştir' : requiresTwoFactor ? 'Doğrula' : 'Giriş Yap')
            }
          </Button>

          {!requiresTwoFactor && !requiresPasswordChange && (
            <div className="text-center pt-4 border-t border-slate-200/70 space-y-2">
              <Link
                to="/forgot-password"
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors block"
              >
                Şifremi unuttum
              </Link>
              <div className="text-xs text-slate-500">
                Kayıt olmak için sistem yöneticinizle iletişime geçin
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
