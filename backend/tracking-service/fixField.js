const fs = require('fs');
let file = fs.readFileSync('c:/Users/samuel/Documents/education/CPEN 421 - Mobile and Web Software Design/Labs/Course_Project/frontend/web/src/app/(field)/field/page.tsx', 'utf8');

const importReplacement = "import { DashboardMap } from '@/app/(ops)/dashboard/DashboardMap';\nimport { ErrorState } from '@/components/ui/ErrorState';";
file = file.replace("import { ErrorState } from '@/components/ui/ErrorState';", importReplacement);

const stylesReplacement = 
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    background: '#e0e0e0'
  },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)'
  },
  brand: { fontWeight: '700', fontSize: '16px' },
  userName: { fontSize: '13px', color: 'var(--color-text-muted)' },
  bottomSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
    background: 'var(--color-surface)',
    borderTopLeftRadius: '20px',
    borderTopRightRadius: '20px',
    padding: '20px 16px',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '50vh',
    overflowY: 'auto'
  },;

file = file.replace(/  page: \{[\s\S]*?userName: .*?\},/, stylesReplacement);

const newRender =   return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div>
          <Text className={styles.brand}>NERDCO Field</Text>
          <Text as="p" className={styles.userName}>{user?.name}</Text>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            appearance="transparent"
            icon={<PersonRegular />}
            onClick={() => router.push('/field/profile')}
            aria-label="Profile"
          />
          <Button
            appearance="transparent"
            icon={<SignOutRegular />}
            onClick={handleLogout}
            aria-label="Sign out"
          />
        </div>
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
         <DashboardMap incidents={incidents} vehicles={[]} selectedId={myIncident?.parent_incident_id || myIncident?.id || null} onSelect={() => {}} />
      </div>

      <div className={styles.bottomSheet}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spinner />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* Active / assigned incident banner */}
            {myIncident ? (
              <div className={styles.assignedBanner}>
                <Text className={styles.bannerTitle}>
                  <AlertUrgentRegular style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Active assignment
                </Text>
                <Text className={styles.bannerMeta}>{myIncident.location_name ?? 'Unknown location'}</Text>
                <Text className={styles.bannerMeta}>{myIncident.incident_type?.toUpperCase()} · {myIncident.status?.replace('_', ' ').toUpperCase()}</Text>
                <button className={styles.goBtn} onClick={() => router.push(\/field/incident?id=\\)}>
                  View details
                </button>
              </div>
            ) : (
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: '13px',
              }}>
                No active assignment. Standing by.
              </div>
            )}

            {queuedIncidents.length > 0 && (
              <>
                <Text className={styles.sectionTitle}>Incoming ({queuedIncidents.length})</Text>
                {queuedIncidents.map(inc => (
                  <div key={inc.id} className={\\ card-hover\} onClick={() => router.push(\/field/incident?id=\\)}>
                    <div className={styles.cardHeader}>
                      <Text className={styles.cardTitle}>{inc.location_name ?? 'Incident'}</Text>
                      <IncidentStatusBadge status={inc.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <IncidentTypeChip type={inc.incident_type} />
                      <Text className={styles.cardMeta}>{new Date(inc.created_at).toLocaleTimeString()}</Text>
                    </div>
                  </div>
                ))}
              </>
            )}
            {queuedIncidents.length === 0 && <div className={styles.empty}>No pending incidents in queue.</div>}
          </>
        )}
      </div>
    </div>
  );
};

file = file.replace(/  return \([\s\S]*?\);\n\}/, newRender);

fs.writeFileSync('c:/Users/samuel/Documents/education/CPEN 421 - Mobile and Web Software Design/Labs/Course_Project/frontend/web/src/app/(field)/field/page.tsx', file);
