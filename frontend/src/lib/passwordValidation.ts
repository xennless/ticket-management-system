import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

type PasswordPolicy = {
  minPasswordLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecialChar: boolean;
};

export function usePasswordPolicy() {
  const { data: settings } = useQuery<PasswordPolicy>({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/api/settings'),
    staleTime: 5 * 60 * 1000, // 5 dakika cache
    select: (data) => ({
      minPasswordLength: data.minPasswordLength || 8,
      passwordRequireUppercase: data.passwordRequireUppercase || false,
      passwordRequireLowercase: data.passwordRequireLowercase || false,
      passwordRequireNumber: data.passwordRequireNumber || false,
      passwordRequireSpecialChar: data.passwordRequireSpecialChar || false
    })
  });

  return settings || {
    minPasswordLength: 8,
    passwordRequireUppercase: false,
    passwordRequireLowercase: false,
    passwordRequireNumber: false,
    passwordRequireSpecialChar: false
  };
}

export function validatePasswordFrontend(
  password: string,
  policy: PasswordPolicy
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < policy.minPasswordLength) {
    errors.push(`Şifre en az ${policy.minPasswordLength} karakter olmalıdır`);
  }

  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Şifre en az bir büyük harf içermelidir');
  }

  if (policy.passwordRequireLowercase && !/[a-z]/.test(password)) {
    errors.push('Şifre en az bir küçük harf içermelidir');
  }

  if (policy.passwordRequireNumber && !/\d/.test(password)) {
    errors.push('Şifre en az bir rakam içermelidir');
  }

  if (policy.passwordRequireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Şifre en az bir özel karakter içermelidir');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

