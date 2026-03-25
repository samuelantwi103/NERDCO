const fs = require('fs');
const pagePath = 'frontend/web/src/app/(ops)/admin/organizations/page.tsx';
let p = fs.readFileSync(pagePath, 'utf8');

p = p.replace(\import { AddRegular, BuildingMultipleRegular, HeartPulseRegular, VehicleCarRegular, ShieldRegular } from '@fluentui/react-icons';\, 
\import { AddRegular, BuildingMultipleRegular, HeartPulseRegular, VehicleCarRegular, ShieldRegular, EditRegular, DeleteRegular } from '@fluentui/react-icons';
import { updateOrganization, deleteOrganization } from '@/lib/api/auth';\);

p = p.replace(\const [error,    setError]    = useState('');\, 
\const [error,    setError]    = useState('');
  const [editingId, setEditingId] = useState<string|null>(null);
  const [deleteId, setDeleteId] = useState<string|null>(null);\);

p = p.replace(\sync function handleCreate(e: FormEvent) {\,
\
  function openEdit(o: any) {
    setEditingId(o.id);
    setForm({ name: o.name, type: o.type, lat: String(o.latitude), lng: String(o.longitude), address: o.address || '', phone: o.phone || '' });
    setOpen(true);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ name: '', type: 'hospital', lat: '', lng: '', address: '', phone: '' });
    setOpen(true);
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await deleteOrganization(token, deleteId!);
      setDeleteId(null);
      setOrgs(await listOrganizations(token));
    } catch(err: any) {
      setError(err?.response?.data?.message ?? 'Failed to delete organization');
    } finally { setSaving(false); }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (editingId) {
       await handleEdit(e);
    } else {
       await handleCreate(e);
    }
  }

  async function handleEdit(e: FormEvent) {
    setError(''); setSaving(true);
    try {
      await updateOrganization(token, editingId!, { 
        name: form.name, type: form.type, latitude: parseFloat(form.lat), longitude: parseFloat(form.lng), 
        address: form.address || undefined, phone: form.phone || undefined 
      });
      setOpen(false);
      setOrgs(await listOrganizations(token));
    } catch(err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update organization');
    } finally { setSaving(false); }
  }

  async function handleCreate(e: FormEvent) {
\);


p = p.replace(\<div>
                <Text className={styles.title}>{o.name}</Text>\,
\<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div>
                    <Text className={styles.title}>{o.name}</Text>\);

p = p.replace(\</Text>
              </div>\,
\</Text>
                  </div>
                  {user?.role === 'system_admin' && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={(e) => { e.stopPropagation(); openEdit(o); }} />
                      <Button size="small" appearance="subtle" style={{ color: 'var(--color-fire)' }} icon={<DeleteRegular />} onClick={(e) => { e.stopPropagation(); setDeleteId(o.id); }} />
                    </div>
                  )}
                </div>\);

p = p.replace(\onClick={() => setOpen(true)}\, \onClick={openAdd}\);

p = p.replace(\<form onSubmit={handleCreate}>\, \<form onSubmit={handleSave}>\);
p = p.replace(\<DialogTitle>Register organisation</DialogTitle>\, \<DialogTitle>{editingId ? 'Edit organisation' : 'Register organisation'}</DialogTitle>\);
p = p.replace(\{saving ? <Spinner size="tiny" /> : 'Save organisation'}\, \{saving ? <Spinner size="tiny" /> : editingId ? 'Save changes' : 'Save organisation'}\);

p = p.replace(\</PageShell>\, \
      <Dialog open={!!deleteId} onOpenChange={(_, d) => !d.open && setDeleteId(null)}>
        <DialogSurface style={{ maxWidth: '400px' }}>
          <form onSubmit={handleDelete}>
            <DialogTitle>Delete organisation</DialogTitle>
            <DialogBody>
              <Text>Are you sure you want to delete this organisation? This action cannot be undone and will affect linked users or vehicles.</Text>
              {error && <Text style={{ color: 'var(--color-fire)', fontSize: '13px', display: 'block', marginTop: '8px' }}>{error}</Text>}
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button type="submit" appearance="primary" disabled={saving} style={{ background: 'var(--color-fire)', color: 'white', border: 'none' }}>
                {saving ? <Spinner size="tiny" /> : 'Delete'}
              </Button>
            </DialogActions>
          </form>
        </DialogSurface>
      </Dialog>
    </PageShell>
\);

fs.writeFileSync(pagePath, p);
