import { useState, useCallback } from 'react';
import { AlertDialog } from '../../components/AccessibleModal';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm: () => void;
}

const defaultState: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'danger',
  onConfirm: () => {},
};

/**
 * Hook for showing a styled confirmation dialog instead of browser's confirm()
 *
 * Usage:
 * ```tsx
 * const { confirm, ConfirmDialog } = useConfirmDialog();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete item?',
 *     message: 'This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     variant: 'danger'
 *   });
 *   if (confirmed) {
 *     // proceed with delete
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     <ConfirmDialog />
 *   </>
 * );
 * ```
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(defaultState);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolveRef(() => resolve);
      setState({
        isOpen: true,
        ...options,
        onConfirm: () => {
          resolve(true);
          setState(defaultState);
          setResolveRef(null);
        },
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolveRef) {
      resolveRef(false);
    }
    setState(defaultState);
    setResolveRef(null);
  }, [resolveRef]);

  const ConfirmDialog = useCallback(() => (
    <AlertDialog
      isOpen={state.isOpen}
      onClose={handleClose}
      onConfirm={state.onConfirm}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
    />
  ), [state, handleClose]);

  return { confirm, ConfirmDialog };
}

export default useConfirmDialog;
