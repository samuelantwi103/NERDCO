const fs = require('fs');
const pagePath = 'frontend/web/src/app/(ops)/admin/users/page.tsx';
let p = fs.readFileSync(pagePath, 'utf8');

// replace AddRegular import
p = p.replace(\"import { AddRegular, PersonRegular } from '@fluentui/react-icons';\", \"import { AddRegular, PersonRegular, EditRegular, DeleteRegular } from '@fluentui/react-icons';\\nimport { updateUser, deleteUser } from '@/lib/api/auth';\");

// add state variables
p = p.replace(\"const [error,    setError]    = useState('');\", 
\const [error,    setError]    = useState('');
  const [editingId, setEditingId] = useState<string|null>(null);
  const [deleteId, setDeleteId] = useState<string|null>(null);\);

// update handleCreate to something general or add handleUpdate & handleDelete
p = p.replace(\"async function handleCreate(e: FormEvent) {\",
\
  function openEdit(u: any) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, organization_id: u.organization_id || '' });
    setOpen(true);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ name: '', email: '', role: 'first_responder', organization_id: '' });
    setOpen(true);
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await deleteUser(token, deleteId!);
      setDeleteId(null);
      setUsers(await listUsers(token));
    } catch(err: any) {
      setError(err?.response?.data?.message ?? 'Failed to delete user');
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
      await updateUser(token, editingId!, { name: form.name, role: form.role, organization_id: form.organization_id || undefined });
      setOpen(false);
      setUsers(await listUsers(token));
    } catch(err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update user');
    } finally { setSaving(false); }
  }

  async function handleCreate(e: FormEvent) {
\);

p = p.replace(\"columns: Column<any>[] = [\", \columns: Column<any>[] = [
    { key: 'actions', label: 'Actions', width: '100px', render: (u: any) => (
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button size="small" appearance="subtle" icon={<EditRegular />} onClick={() => openEdit(u)} />
        {user?.role === 'system_admin' && <Button size="small" appearance="subtle" icon={<DeleteRegular />} onClick={() => setDeleteId(u.id)} />}
      </div>
    )},
\);

p = p.replace(\"onClick={() => setOpen(true)}\", \"onClick={openAdd}\");

p = p.replace(\"<form onSubmit={handleCreate}>\", \"<form onSubmit={handleSave}>\");
p = p.replace(\"<DialogTitle>Add user</DialogTitle>\", \"<DialogTitle>{editingId ? 'Edit user' : 'Add user'}</DialogTitle>\");
p = p.replace(\"{saving ? <Spinner size=\\\"tiny\\\" /> : 'Create user'}\", \"{saving ? <Spinner size=\\\"tiny\\\" /> : editingId ? 'Save changes' : 'Create user'}\");
p = p.replace(\"type=\\\"email\\\" value={form.email}\", \"type=\\\"email\\\" disabled={!!editingId} value={form.email}\");

p += \

function UserDeleteDialog() {
  return null;
}
\;

p = p.replace(\"</PageShell>\", \
      <Dialog open={!!deleteId} onOpenChange={(_, d) => !d.open && setDeleteId(null)}>
        <DialogSurface style={{ maxWidth: '400px' }}>
          <form onSubmit={handleDelete}>
            <DialogTitle>Delete user</DialogTitle>
            <DialogBody>
              <Text>Are you sure you want to delete this user? This action cannot be undone.</Text>
              {error && <Text style={{ color: 'var(--color-fire)', fontSize: '13px', display: 'block', marginTop: '8px' }}>{error}</Text>}
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button type="submit" appearance="primary" disabled={saving} style={{ background: 'var(--color-fire)', color: 'white', border: 'none' }}>
                {saving ? <Spinner size="tiny" /> : 'Delete user'}
              </Button>
            </DialogActions>
          </form>
        </DialogSurface>
      </Dialog>
    </PageShell>
\);

fs.writeFileSync(pagePath, p);

