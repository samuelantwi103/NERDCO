'use client';
import dynamic from 'next/dynamic';
import { makeStyles } from '@fluentui/react-components';

const Sidebar = dynamic(() => import('./Sidebar').then(m => ({ default: m.Sidebar })), { ssr: false });

const useStyles = makeStyles({
  shell: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--color-bg)',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
});

export function AppShell({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
