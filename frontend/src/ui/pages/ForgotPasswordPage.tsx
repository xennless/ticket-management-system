import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export function ForgotPasswordPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) return 'Email gereklidir';
    const emailRegex = /^[^\s@]+@[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Geçersiz email formatı';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/password-reset/request', {
        method: 'POST',
        json: { email }
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <Card className="w-full max-w-md shadow-xl animate-scale-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">Email Gönderildi</div>
            <div className="text-sm text-slate-600">
              Eğer bu email adresi sistemde kayıtlıysa, şifre sıfırlama linki gönderildi.
              <br />
              Lütfen email kutunuzu kontrol edin.
            </div>
          </div>
          <div className="space-y-4">
            <Button className="w-full" onClick={() => nav('/login')}>
              Giriş Sayfasına Dön
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
            <Mail className="w-8 h-8" />
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-2">Şifremi Unuttum</div>
          <div className="text-sm text-slate-600">Email adresinize şifre sıfırlama linki göndereceğiz</div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Email" error={emailError} hint="Kayıtlı email adresiniz">
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

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 animate-fade-in">
              {error}
            </div>
          )}

          <Button className="w-full" type="submit" disabled={loading || !email.trim()}>
            {loading ? 'Gönderiliyor…' : 'Şifre Sıfırlama Linki Gönder'}
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

