'use client';

import { useState, useEffect, useRef } from 'react';

const SERVICES = [
  { name: 'Auth', url: process.env.NEXT_PUBLIC_AUTH_URL },
  { name: 'Incident', url: process.env.NEXT_PUBLIC_INCIDENT_URL },
  { name: 'Tracking', url: process.env.NEXT_PUBLIC_TRACKING_URL },
  { name: 'Analytics', url: process.env.NEXT_PUBLIC_ANALYTICS_URL },
];

export function ServiceHealthOverlay() {
  const [statuses, setStatuses] = useState<Record<string, boolean | null>>({});
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 20, startPosY: 20 });

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      const newStatuses = { ...statuses };
      await Promise.all(SERVICES.map(async (svc) => {
        if (!svc.url) {
          newStatuses[svc.name] = false;
          return;
        }
        try {
          // Use cache: 'no-store' to ensure we capture live health state
          const res = await fetch(`${svc.url}/health`, { method: 'GET', mode: 'cors', cache: 'no-store' });
          newStatuses[svc.name] = res.ok;
        } catch {
          newStatuses[svc.name] = false;
        }
      }));
      if (mounted) setStatuses(prev => ({ ...prev, ...newStatuses }));
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // right/bottom coords decrease as you drag toward the respective edge, so invert
    setPosition({
      x: dragRef.current.startPosX - dx,
      y: dragRef.current.startPosY - dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        bottom: position.y,
        right: position.x,
        zIndex: 999999, // Must sit above maps, tooltips, modalds, etc
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0,0,0,0.1)',
        padding: '8px 12px',
        borderRadius: '24px',
        display: 'flex',
        gap: '8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        touchAction: 'none'
      }}
    >
      {SERVICES.map((svc) => {
        const isUp = statuses[svc.name];
        const color = isUp === true ? '#4caf50' : (isUp === false ? '#f44336' : '#ff9800'); // Orange = loading
        return (
          <div
            key={svc.name}
            title={svc.name}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}`
            }}
          />
        );
      })}
    </div>
  );
}
