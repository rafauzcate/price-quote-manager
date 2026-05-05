import { Dialog, DialogPanel } from '@headlessui/react';
import { type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}

export function Modal({ open, onClose, children, panelClassName = '' }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className={`w-full max-w-xl rounded-2xl border border-slatePremium-200 bg-white shadow-premium ${panelClassName}`}
        >
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
