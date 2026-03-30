'use client';
import { useEffect, useState } from 'react';
import { FluentProvider, createLightTheme, createDarkTheme, type BrandVariants } from '@fluentui/react-components';
import { AuthProvider } from '@/lib/context/AuthContext';
import { ToastProvider, useToast } from '@/lib/context/ToastContext';
import axios from 'axios';

function AxiosInterceptor() {
  const { notifyError } = useToast();

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          if (error.response.status >= 500) {
            notifyError('Server Error', 'The server encountered an unexpected error.');
          }
        } else if (error.request) {
          notifyError('Network Error', 'Could not connect to the server.');
        } else {
          notifyError('Application Error', error.message);
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [notifyError]);

  return null;
}

// NERDCO brand palette — black primary with Fluent structure
const nerdcoBrand: BrandVariants = {
  10:  '#020202', 20:  '#111111', 30:  '#1A1A1A', 40:  '#242424',
  50:  '#2E2E2E', 60:  '#383838', 70:  '#424242', 80:  '#4C4C4C',
  90:  '#565656', 100: '#606060', 110: '#6A6A6A', 120: '#747474',
  130: '#7E7E7E', 140: '#888888', 150: '#929292', 160: '#9C9C9C',
};

const nerdcoLightTheme = createLightTheme(nerdcoBrand);
const nerdcoDarkTheme = createDarkTheme(nerdcoBrand);

export function Providers({ children }: { children: React.ReactNode }) {        
  // Suppress the Fluent UI CSS-in-JS hydration flash: don't render until       
  // the client has mounted and the style sheet is injected.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <FluentProvider theme={nerdcoLightTheme} style={mounted ? undefined : { visibility: 'hidden' }}>
      <ToastProvider>
        <AxiosInterceptor />
        <AuthProvider>
          {children}
        </AuthProvider>
      </ToastProvider>
    </FluentProvider>
  );
}
