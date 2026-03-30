'use client';
import { createContext, useContext, ReactNode } from 'react';
import { Toaster, useId, useToastController, Toast, ToastTitle, ToastBody, ToastIntent } from '@fluentui/react-components';

interface ToastContextType {
  notify: (title: string, body?: string, intent?: ToastIntent) => void;
  notifyError: (title: string, body?: string) => void;
  notifySuccess: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasterId = useId('global-toaster');
  const { dispatchToast } = useToastController(toasterId);

  const notify = (title: string, body?: string, intent: ToastIntent = 'info') => {
    dispatchToast(
      <Toast>
        <ToastTitle>{title}</ToastTitle>
        {body && <ToastBody>{body}</ToastBody>}
      </Toast>,
      { intent }
    );
  };

  const notifyError = (title: string, body?: string) => notify(title, body, 'error');
  const notifySuccess = (title: string, body?: string) => notify(title, body, 'success');

  return (
    <ToastContext.Provider value={{ notify, notifyError, notifySuccess }}>
      <>
        {children}
        <Toaster toasterId={toasterId} position="top-end" />
      </>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

/** Convenience hook: returns a single `showToast(message, variant?)` function. */
export function useShowToast() {
  const { notifySuccess, notifyError, notify } = useToast();
  return (message: string, variant: 'success' | 'error' | 'info' = 'success') => {
    if (variant === 'success') notifySuccess(message);
    else if (variant === 'error') notifyError(message);
    else notify(message, undefined, 'info');
  };
}
