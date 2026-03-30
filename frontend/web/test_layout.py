import re

with open('src/app/(field)/field/incident/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update vehicle check to refresh inside useAutoRefresh
# Replace the listVehicles useEffect with fetching inside useAutoRefresh
text = re.sub(
    r"  // Load vehicles once for backup plate lookup.*?  }, \[token\]\];\n",
    "", text, flags=re.DOTALL
)

polling_old = """    const [inc, rel] = await Promise.all([
      getIncident(token, incId),
      getRelatedIncidents(token, incId),
    ]);
    setIncident(inc);
    setRelated(rel);
    setLoading(false);"""
polling_new = """    const [inc, rel, veh] = await Promise.all([
      getIncident(token, incId),
      getRelatedIncidents(token, incId),
      listVehicles(token).catch(() => [] as any[])
    ]);
    setIncident(inc);
    setRelated(rel);
    if (veh && veh.length > 0) setVehicles(veh);
    setLoading(false);"""
text = text.replace(polling_old, polling_new)

# 2. Update styles to make map take full remaining height and details float
styles_old = """  const useStyles = makeStyles({
    page: { display: 'flex', flexDirection: 'column', minHeight: '100vh' },
    topBar: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '12px 16px', borderBottom: '1px solid var(--color-border)', 
      background: 'var(--color-surface)',
    },
    topTitle: { fontWeight: '700', fontSize: '16px', flex: 1 },
    mapBox: { height: '50vh', position: 'relative', background: 'var(--color-bg)', overflow: 'hidden' },
    navTopBox: {
      position: 'absolute', top: '16px', left: '16px', right: '16px',      
      background: '#0d4722', color: '#fff', borderRadius: '12px', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100,
    },
    navBottomBox: {
      position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#fff', borderRadius: '24px', padding: '12px 24px',      
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, minWidth: '200px'
    },
    navMainText: { fontSize: '20px', fontWeight: 'bold' },
    navSubText: { fontSize: '14px', opacity: 0.9 },
    durationText: { fontSize: '20px', fontWeight: 'bold', color: '#b36b00' },
    distanceText: { fontSize: '14px', color: '#666' },
    body: {
      padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
      background: 'var(--color-surface)', borderTopLeftRadius: '16px',     
      borderTopRightRadius: '16px', marginTop: '-16px', zIndex: 10,        
      boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
    },"""

styles_new = """  const useStyles = makeStyles({
    page: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' },
    topBar: {
      display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10,
      padding: '12px 16px', borderBottom: '1px solid var(--color-border)', 
      background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
    },
    topTitle: { fontWeight: '700', fontSize: '16px', flex: 1 },
    mapBox: { flex: 1, position: 'relative', background: 'var(--color-bg)', overflow: 'hidden' },
    navTopBox: {
      position: 'absolute', top: '12px', left: '12px', right: '12px',      
      background: '#0d4722', color: '#fff', borderRadius: '12px', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100,
    },
    navMainText: { fontSize: '18px', fontWeight: '600' },
    navSubText: { fontSize: '13px', opacity: 0.9 },
    navBottomBox: {
      position: 'absolute', bottom: '24px', left: 'auto', right: '16px',
      background: '#fff', borderRadius: '16px', padding: '8px 16px',      
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '2px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100, 
    },
    durationText: { fontSize: '18px', fontWeight: 'bold', color: '#b36b00' },
    distanceText: { fontSize: '13px', color: '#666', fontWeight: '500' },
    legend: {
      position: 'absolute', top: '100px', right: '12px', background: 'rgba(255,255,255,0.9)',
      padding: '8px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', zIndex: 100,
      backdropFilter: 'blur(4px)', pointerEvents: 'none'
    },
    bottomPanel: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--color-surface)', borderTopLeftRadius: '24px',     
      borderTopRightRadius: '24px', zIndex: 200,        
      boxShadow: '0 -8px 24px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      maxHeight: '50vh', transition: 'transform 0.3s ease',
    },
    dragHandle: {
      width: '40px', height: '4px', background: 'var(--color-border)', borderRadius: '2px',
      margin: '12px auto', cursor: 'grab'
    },
    bodyScroll: {
      padding: '0 20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px'
    },"""
text = text.replace(styles_old, styles_new)

with open('src/app/(field)/field/incident/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Step 1 done")
