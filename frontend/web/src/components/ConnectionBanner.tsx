'use client';
import { makeStyles } from '@fluentui/react-components';
import { WifiWarningRegular } from '@fluentui/react-icons';
import type { WsStatus } from '@/lib/hooks/useWebSocket';

const useStyles = makeStyles({
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 20px',
    background: '#FEFCE8',
    borderBottom: '1px solid #FDE047',
    fontSize: '12px',
    fontWeight: '500',
    color: '#854D0E',
    zIndex: 100,
  },
});

interface Props {
  status: WsStatus;
}

export function ConnectionBanner({ status }: Props) {
  const styles = useStyles();

  if (status === 'connected') return null;

  const label = status === 'connecting'
    ? 'Reconnecting to live updates…'
    : 'Real-time updates paused — retrying…';

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <WifiWarningRegular fontSize={14} />
      {label}
    </div>
  );
}
