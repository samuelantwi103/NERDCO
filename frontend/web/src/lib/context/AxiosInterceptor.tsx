'use client';
import { useEffect } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';

export function AxiosInterceptor() {
  const { notifyError } = useToast();

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // We only want to surface true server or network errors, not controlled 401/403 validation stuff (unless unhandled).
        if (error.response) {
          const status = error.response.status;
          if (status >= 500) {
            notifyError('Server Error', 'The server encountered an unexpected error. Please try again.');
          } else if (status === 408 || status === 504) {
            notifyError('Timeout', 'The request timed out. Please check your connection.');
          } else if (status === 429) {
            notifyError('Too Many Requests', 'Rate limit exceeded. Please wait a moment.');
          }
          // Note: we let 400, 401, 403, 404 pass through to be handled by the UI logic
        } else if (error.request) {
          notifyError('Network Error', 'Could not connect to the server. Are you offline?');
        } else {
          notifyError('Application Error', error.message);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [notifyError]);

  return null;
}
