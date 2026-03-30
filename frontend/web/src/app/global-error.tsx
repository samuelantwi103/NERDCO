'use client';
import { Button, Title1, Text } from '@fluentui/react-components';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
          <Title1>Something went wrong!</Title1>
          <Text>{error.message}</Text>
          <Button appearance="primary" onClick={() => reset()}>Try again</Button>
        </div>
      </body>
    </html>
  );
}