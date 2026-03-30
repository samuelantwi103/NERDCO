'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Text, Button, Field, Input, Select, Spinner, Badge,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions,
} from '@fluentui/react-components';
import { AddRegular, PersonRegular, EditRegular, DeleteRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { listUsers, createUser, updateUser, deleteUser } from '@/lib/api/auth';
import { listVehicles } from '@/lib/api/tracking';
import { POLLING } from '@/lib/config/polling';
import { staffSchema } from '@/lib/schemas';
import { PageShell } from '@/components/ui/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { usePagination } from '@/lib/hooks/usePagination';
import { PaginationBar } from '@/components/ui/PaginationBar';

export default function StaffPage() {
  const { user } = useAuth();
  const router = useRouter();
  const token = user?.access_token ?? '';
  const { notifySuccess, notifyError } = useToast();

  const fetcher = async () => {
    const [u, v] = await Promise.all([listUsers(token), listVehicles(token).catch(() => [])]);
    return { staff: u as any[], vehicles: v as any[] };
  };

  const { data, isLoading: loading, mutate } = useSWR(token ? ['staff-data', token] : null, fetcher, {
    refreshInterval: POLLING.ADMIN,
  });

  const staff = data?.staff ?? [];
  const vehicles = data?.vehicles ?? [];

  const [open,     setOpen]     = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [editId,   setEditId]   = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', email: '', role: 'first_responder' });

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'org_admin') router.replace('/dashboard');
  }, [user, router]);

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function openEdit(u: any) {
    setEditId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role });
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setEditId(null);
    setForm({ name: '', email: '', role: 'first_responder' });
    setError('');
  }

  async function handleCreateOrUpdate(e: FormEvent) {
    e.preventDefault();

    const parsed = staffSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError(''); setSaving(true);
    try {
      if (editId) {
        await updateUser(token, editId, { name: form.name, role: form.role });
      } else {
        await createUser(token, { name: form.name, email: form.email, role: form.role, organization_id: user?.org ?? undefined });
      }
      handleClose();
      notifySuccess('Success', editId ? 'Staff updated' : 'Staff created');
      mutate();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save staff member';
      setError(msg);
      notifyError('Error', msg);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deleteUser(token, deleteId);
      setDeleteId(null);
      notifySuccess('Deleted', 'Staff member removed');
      mutate();
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.message ?? 'Failed to delete user');
    } finally { setSaving(false); }
  }

  const myStaff = user?.role === 'system_admin' ? staff : staff.filter(s => s.organization_id === user?.org);
  const { slice: staffSlice, page: staffPage, total: staffTotal, setPage: setStaffPage } = usePagination(myStaff);

  const columns: Column<any>[] = [
    { key: 'name',    label: 'Name',    render: s => <span style={{ fontWeight: '500' }}>{s.name}</span> },
    { key: 'email',   label: 'Email',   render: s => <span style={{ color: 'var(--color-text-secondary)' }}>{s.email}</span> },
    {
      key: 'role', label: 'Role',
      render: s => (
        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '999px', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
          {s.role?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'vehicle', label: 'Assigned vehicle',
      render: s => {
        const v = vehicles.find(v => v.driver_user_id === s.id);
        return v
          ? <span style={{ fontWeight: '600' }}>{v.license_plate}</span>
          : <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>;
      },
    },
    {
      key: 'status', label: 'Status', width: '90px',
      render: s => <Badge appearance="tint" color={s.is_active ? 'success' : 'subtle'} size="small">{s.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions', label: '', width: '100px',
      render: s => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button appearance="transparent" icon={<EditRegular fontSize={16} />} onClick={() => openEdit(s)} title="Edit user" />
          <Button appearance="transparent" icon={<DeleteRegular fontSize={16} />} onClick={() => setDeleteId(s.id)} style={{ color: 'var(--color-fire)' }} title="Delete user" />
        </div>
      ),
    },
  ];

  if (!user || user.role !== 'org_admin') return null;

  return (
    <PageShell
      title="Staff"
      subtitle={`${myStaff.length} team member${myStaff.length !== 1 ? 's' : ''}`}
      loading={loading}
      actions={
        <Button appearance="primary" icon={<AddRegular />} style={{ background: 'var(--color-accent)', border: 'none' }} onClick={() => setOpen(true)}>
          Add staff member
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={staffSlice}
        rowKey={s => s.id}
        emptyTitle="No staff yet"
        emptyDescription="Add driver and responder accounts for your team."
      />
      <PaginationBar page={staffPage} total={staffTotal} onChange={setStaffPage} />

      <Dialog open={open} onOpenChange={(_, d) => !d.open && handleClose()}>
        <DialogSurface style={{ maxWidth: '420px' }}>
          <form onSubmit={handleCreateOrUpdate}>
            <DialogTitle>{editId ? 'Edit staff member' : 'Add staff member'}</DialogTitle>
            <DialogBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px', marginTop: '12px' }}>
                <Field label="Full name" required>
                  <Input value={form.name} onChange={e => setField('name', e.target.value)} required autoFocus />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} required disabled={!!editId} />
                </Field>
                <Field label="Role" required>
                  <Select value={form.role} onChange={e => setField('role', e.target.value)}>
                    <option value="first_responder">First responder</option>
                  </Select>
                </Field>
                {error && <Text style={{ color: 'var(--color-fire)', fontSize: '13px' }}>{error}</Text>}
                {!editId && (
                  <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    A temporary password will be emailed to the staff member.
                  </Text>
                )}
              </div>
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={handleClose}>Cancel</Button>
              <Button type="submit" appearance="primary" disabled={saving} style={{ background: 'var(--color-accent)', border: 'none' }}>
                {saving ? <Spinner size="tiny" /> : 'Save'}
              </Button>
            </DialogActions>
          </form>
        </DialogSurface>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(_, d) => !d.open && setDeleteId(null)}>
        <DialogSurface>
          <DialogTitle>Confirm deletion</DialogTitle>
          <DialogBody>
            Are you sure you want to delete this staff member? This action cannot be undone.
          </DialogBody>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setDeleteId(null)} disabled={saving}>Cancel</Button>
            <Button appearance="primary" onClick={handleDelete} disabled={saving} style={{ background: 'var(--color-fire)', color: 'white' }}>
              {saving ? <Spinner size="tiny" /> : 'Delete staff'}
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </PageShell>
  );
}
