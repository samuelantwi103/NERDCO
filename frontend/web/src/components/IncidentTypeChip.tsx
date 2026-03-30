'use client';
import { Badge } from '@fluentui/react-components';

type IncidentType = 'medical' | 'fire' | 'police' | 'robbery' | 'crime' | string;

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  medical: { color: 'var(--color-medical)', label: 'Medical' },
  fire:    { color: 'var(--color-fire)',    label: 'Fire'    },
  police:  { color: 'var(--color-police)',  label: 'Police'  },
  robbery: { color: 'var(--color-police)',  label: 'Robbery' },
  crime:   { color: 'var(--color-police)',  label: 'Crime'   },
};

export function IncidentTypeChip({ type }: { type: IncidentType }) {
  const style = TYPE_STYLES[type] ?? { color: 'var(--color-unassigned)', label: type };
  return (
    <Badge
      appearance="filled"
      size="small"
      style={{ background: style.color, color: '#fff', textTransform: 'capitalize' }}
    >
      {style.label}
    </Badge>
  );
}
