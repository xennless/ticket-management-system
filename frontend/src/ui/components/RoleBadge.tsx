import clsx from 'clsx';
import { RoleIcon } from '../icons';

export function RoleBadge({
  icon,
  color,
  text,
  className
}: {
  icon?: string | null;
  color?: string | null;
  text: string;
  className?: string;
}) {
  const c = color ?? '#0f172a';
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs', className)}
      style={{ borderColor: c, color: c }}
      title={text}
    >
      <RoleIcon icon={icon} className="w-3.5 h-3.5" />
      <span className="truncate max-w-[160px]">{text}</span>
    </span>
  );
}


