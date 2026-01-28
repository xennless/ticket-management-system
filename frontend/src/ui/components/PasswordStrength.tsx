import clsx from 'clsx';
import { usePasswordPolicy } from '../../lib/passwordValidation';

export function PasswordStrength({ password, showErrors = false }: { password: string; showErrors?: boolean }) {
  const policy = usePasswordPolicy();
  
  if (!password) return null;

  const checks = {
    length: password.length >= policy.minPasswordLength,
    uppercase: policy.passwordRequireUppercase ? /[A-Z]/.test(password) : true,
    lowercase: policy.passwordRequireLowercase ? /[a-z]/.test(password) : true,
    number: policy.passwordRequireNumber ? /\d/.test(password) : true,
    special: policy.passwordRequireSpecialChar ? /[!@#$%^&*(),.?":{}|<>]/.test(password) : true
  };

  // Sadece zorunlu olanları say
  const requiredChecks = [
    checks.length,
    policy.passwordRequireUppercase ? checks.uppercase : null,
    policy.passwordRequireLowercase ? checks.lowercase : null,
    policy.passwordRequireNumber ? checks.number : null,
    policy.passwordRequireSpecialChar ? checks.special : null
  ].filter((check): check is boolean => check !== null);

  const passedChecks = requiredChecks.filter(Boolean).length;
  const totalChecks = requiredChecks.length;
  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 5) : 0;
  
  const strength = score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong';
  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-emerald-500'
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={clsx(
              'h-1 flex-1 rounded-full transition',
              i <= score ? strengthColors[strength] : 'bg-slate-200'
            )}
          />
        ))}
      </div>
      <div className="text-xs text-slate-600 space-y-1">
        <div className={clsx('flex items-center gap-2', checks.length ? 'text-emerald-600' : 'text-red-600')}>
          <span>{checks.length ? '✓' : '○'}</span>
          <span>En az {policy.minPasswordLength} karakter</span>
        </div>
        {policy.passwordRequireUppercase && (
          <div className={clsx('flex items-center gap-2', checks.uppercase ? 'text-emerald-600' : 'text-red-600')}>
            <span>{checks.uppercase ? '✓' : '○'}</span>
            <span>Büyük harf (zorunlu)</span>
          </div>
        )}
        {policy.passwordRequireLowercase && (
          <div className={clsx('flex items-center gap-2', checks.lowercase ? 'text-emerald-600' : 'text-red-600')}>
            <span>{checks.lowercase ? '✓' : '○'}</span>
            <span>Küçük harf (zorunlu)</span>
          </div>
        )}
        {policy.passwordRequireNumber && (
          <div className={clsx('flex items-center gap-2', checks.number ? 'text-emerald-600' : 'text-red-600')}>
            <span>{checks.number ? '✓' : '○'}</span>
            <span>Rakam (zorunlu)</span>
          </div>
        )}
        {policy.passwordRequireSpecialChar && (
          <div className={clsx('flex items-center gap-2', checks.special ? 'text-emerald-600' : 'text-red-600')}>
            <span>{checks.special ? '✓' : '○'}</span>
            <span>Özel karakter (zorunlu)</span>
          </div>
        )}
      </div>
      {showErrors && totalChecks > passedChecks && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          <div className="font-medium mb-1">Şifre politikası gereksinimleri:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {!checks.length && <li>En az {policy.minPasswordLength} karakter gerekli</li>}
            {policy.passwordRequireUppercase && !checks.uppercase && <li>En az bir büyük harf gerekli</li>}
            {policy.passwordRequireLowercase && !checks.lowercase && <li>En az bir küçük harf gerekli</li>}
            {policy.passwordRequireNumber && !checks.number && <li>En az bir rakam gerekli</li>}
            {policy.passwordRequireSpecialChar && !checks.special && <li>En az bir özel karakter gerekli</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

