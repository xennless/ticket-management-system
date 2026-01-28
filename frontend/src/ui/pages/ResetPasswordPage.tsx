import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { PasswordStrength } from '../components/PasswordStrength';
import { Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';

export function ResetPasswordPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Geçersiz veya eksik token');
    }
  }, [token]);

  const validatePassword = (pwd: string): string | null => {
    if (!pwd.trim()) return 'Şifre gereklidir';
    if (pwd.length < 8) return 'Şifre en az 8 karakter olmalıdır';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);

    const pwdErr = validatePassword(password);
    if (pwdErr) {
      setPasswordError(pwdErr);
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Şifreler eşleşmiyor');
      return;
    }

    if (!token) {
      setError('Geçersiz token');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/auth/password-reset/reset', {
        method: 'POST',
        json: { token, password }
      });
      setSuccess(true);
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      // Backend'den gelen şifre politikası hatalarını göster
      if (err?.issues && Array.isArray(err.issues)) {
        const policyErrors = err.issues
          .filter((issue: any) => issue.path?.[0] === 'password')
          .map((issue: any) => issue.message);
        if (policyErrors.length > 0) {
          setPasswordError(policyErrors.join(', '));
          setError(null);
        } else {
          setError(errorMessage);
        }
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <Card className="w-full max-w-md shadow-xl animate-scale-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">Geçersiz Link</div>
            <div className="text-sm text-slate-600 mb-4">
              Şifre sıfırlama linki geçersiz veya eksik. Lütfen yeni bir şifre sıfırlama isteği oluşturun.
            </div>
            <Button onClick={() => nav('/forgot-password')}>Yeni Şifre Sıfırlama İsteği</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <Card className="w-full max-w-md shadow-xl animate-scale-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">Şifre Başarıyla Sıfırlandı</div>
            <div className="text-sm text-slate-600 mb-4">
              Şifreniz başarıyla güncellendi. Artık yeni şifrenizle giriş yapabilirsiniz.
            </div>
            <Button className="w-full" onClick={() => nav('/login')}>
              Giriş Sayfasına Git
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <Card className="w-full max-w-md shadow-xl animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-2">Yeni Şifre Belirle</div>
          <div className="text-sm text-slate-600">Yeni şifrenizi belirleyin (en az 8 karakter)</div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Yeni Şifre" error={passwordError} hint="Şifre politikası gereksinimlerini karşılamalıdır">
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                onBlur={() => setPasswordError(validatePassword(password))}
                placeholder="••••••••"
                className="pl-9"
                disabled={loading}
                autoFocus
              />
            </div>
            {password && <PasswordStrength password={password} showErrors={true} />}
          </FormField>

          <FormField label="Şifre Tekrar" error={confirmPasswordError} hint="Şifrenizi tekrar girin">
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError(null);
                }}
                onBlur={() => {
                  if (confirmPassword && password !== confirmPassword) {
                    setConfirmPasswordError('Şifreler eşleşmiyor');
                  } else {
                    setConfirmPasswordError(null);
                  }
                }}
                placeholder="••••••••"
                className="pl-9"
                disabled={loading}
              />
            </div>
          </FormField>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-fade-in">
              {error}
            </div>
          )}

          <Button className="w-full" type="submit" disabled={loading || !password.trim() || !confirmPassword.trim()}>
            {loading ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
          </Button>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Giriş sayfasına dön
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

