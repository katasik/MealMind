'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: Check,
  error: AlertCircle,
  info: Info
};

const styles = {
  success: 'bg-[#DBEDDB] text-[#1E7C45] border-[#C8E4C8]',
  error: 'bg-[#FDEBEC] text-[#EB5757] border-[#FBD4D7]',
  info: 'bg-[#DDEBF1] text-[#0B6E99] border-[#C4DDE9]'
};

export default function Toast({
  message,
  type = 'info',
  isVisible,
  onClose,
  duration = 4000
}: ToastProps) {
  const Icon = icons[type];

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          className="fixed top-20 left-1/2 z-50"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${styles[type]}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{message}</span>
            <button
              onClick={onClose}
              className="p-1 hover:bg-black/5 rounded transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
