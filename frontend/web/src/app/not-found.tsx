'use client';
import { useRouter } from 'next/navigation';
import { Button, Text, makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg)',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'center',
    padding: '24px',
  },
  code: {
    fontSize: '72px',
    fontWeight: '700',
    letterSpacing: '-4px',
    lineHeight: 1,
    color: '#000',
  },
  title: { fontSize: '18px', fontWeight: '600' },
  body:  { fontSize: '14px', color: 'var(--color-text-muted)', maxWidth: '320px' },
});

export default function NotFound() {
  const styles = useStyles();
  const router = useRouter();

  return (
    <div className={styles.page}>
      <Text className={styles.code}>404</Text>
      <Text className={styles.title}>Page not found</Text>
      <Text className={styles.body}>
        This route does not exist. If you followed a link, it may be outdated.
      </Text>
      <Button
        appearance="primary"
        style={{ background: '#000', border: 'none' }}
        onClick={() => router.back()}
      >
        Go back
      </Button>
      <Button appearance="transparent" onClick={() => router.push('/login')}>
        Return to login
      </Button>
    </div>
  );
}
