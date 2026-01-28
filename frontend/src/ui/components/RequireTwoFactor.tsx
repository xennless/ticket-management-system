import { useTwoFactor } from '../../lib/useTwoFactor';
import { Card } from './Card';
import { Button } from './Button';
import { Shield, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RequireTwoFactorProps {
  children: React.ReactNode;
  message?: string;
}

/**
 * Component: 2FA aktif olmayan kullanıcılar için uyarı gösterir
 * Kritik sayfalar için kullanılır
 */
export function RequireTwoFactor({ children, message }: RequireTwoFactorProps) {
  const { isEnabled, isLoading } = useTwoFactor();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="p-6">
        <Card className="p-6 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                2FA Gerekli
              </h2>
              <p className="text-amber-800 mb-4">
                {message || 'Güvenlik sebebiyle bu özelliğe sadece 2FA açık kullanıcılar erişebilir.'}
              </p>
              <p className="text-sm text-amber-700 mb-4">
                Bu sayfaya erişmek için önce iki faktörlü kimlik doğrulamayı (2FA) aktifleştirmeniz gerekmektedir.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => navigate('/auth/2fa')}>
                  <Shield className="w-4 h-4 mr-2" />
                  2FA'yı Aktifleştir
                </Button>
                <Button variant="secondary" onClick={() => navigate(-1)}>
                  Geri Dön
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

