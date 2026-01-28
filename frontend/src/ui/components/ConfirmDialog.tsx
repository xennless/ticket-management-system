import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Onayla',
  cancelText = 'İptal',
  danger = false,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal title={title} open={open} onClose={onClose}>
      {description &&
        (typeof description === 'string' ? (
          <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{description}</div>
        ) : (
          <div className="text-sm text-slate-600 leading-relaxed">{description}</div>
        ))}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {cancelText}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}


