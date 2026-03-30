'use client';
import { useState, FormEvent, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Text, Button, Field, Input, Select, Spinner,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, Badge,
  makeStyles
} from '@fluentui/react-components';
import { AddRegular, EditRegular, DeleteRegular, BuildingRegular, FlowchartRegular, SearchRegular, ArrowResetRegular, DeleteDismissRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useShowToast } from '@/lib/context/ToastContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { listUsers, createUser, updateUser, deleteUser, restoreUser, hardDeleteUser, listOrganizations } from '@/lib/api/auth';
import { POLLING } from '@/lib/config/polling';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageShell } from '@/components/ui/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePagination } from '@/lib/hooks/usePagination';
import { PaginationBar } from '@/components/ui/PaginationBar';

const ROLES = ['first_responder', 'org_admin'] as const;

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  system_admin:   { bg: '#FEF2F2', color: '#B91C1C' },
  org_admin:      { bg: '#EFF6FF', color: '#1D4ED8' },
  first_responder:{ bg: '#F0FDF4', color: '#15803D' },
};

function RolePill({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? { bg: 'var(--color-bg)', color: 'var(--color-text-muted)' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', background: c.bg, color: c.color }}>
      {role.replace(/_/g, ' ')}
    </span>
  );
}

const useStyles = makeStyles({
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '16px 4px 8px',
    borderBottom: '2px solid var(--color-border)',
    marginBottom: '12px'
  },
  groupTitle: { fontWeight: '600', fontSize: '14px' },
  groupCount: { color: 'var(--color-text-muted)', fontSize: '12px', marginLeft: 'auto' },
});

function PaginatedUserTable({ rows, columns }: { rows: any[]; columns: Column<any>[] }) {
  const { slice, page, total, setPage } = usePagination(rows);
  return (
    <>
      <DataTable columns={columns} rows={slice} rowKey={u => u.id} />
      <PaginationBar page={page} total={total} onChange={setPage} />
    </>
  );
}

export default function UsersPage() {
  const styles = useStyles();
  const { user: currentUser } = useAuth();
  const token = currentUser?.access_token ?? '';
  const showToast = useShowToast();

  const router = useRouter();

  const [users,       setUsers]       = useState<any[]>([]);
  const [orgs,        setOrgs]        = useState<any[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  
  // Modals
  const [open,          setOpen]          = useState(false);
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [hardDeleteId,  setHardDeleteId]  = useState<string | null>(null);
  
  const [loading,  setLoading]  = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  // Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'first_responder', organization_id: '', phone: '', password: '' });

  // Inline validation
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nameError  = form.name.trim().length > 0 && form.name.trim().length < 2 ? 'Name must be at least 2 characters' : '';
  const emailError = form.email.length > 0 && !EMAIL_RE.test(form.email) ? 'Enter a valid email address' : '';
  const orgError   = form.role !== 'system_admin' && !form.organization_id ? 'Organisation is required for this role' : '';
  const formValid  = form.name.trim().length >= 2 && EMAIL_RE.test(form.email) && (form.role === 'system_admin' || !!form.organization_id);

  useEffect(() => {
    if (!currentUser) { router.replace('/login'); return; }
    if (currentUser.role !== 'system_admin') router.replace('/dashboard');
  }, [currentUser, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = async () => {
    try {
      setPageError(null);
      const [u, o] = await Promise.all([listUsers(token, showDeleted), listOrganizations(token)]);
      setUsers(u);
      setOrgs(o);
    } catch (err: any) {
      setPageError(err?.message || 'Failed to load users');
    } finally { setLoading(false); }
  };
  useAutoRefresh(loadData, POLLING.ADMIN);

  function resetForm() {
    setEditId(null);
    setForm({ name: '', email: '', role: 'first_responder', organization_id: '', phone: '', password: '' });
    setError('');
  }

  function handleEdit(u: any) {
    setEditId(u.id);
    setForm({
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'first_responder',
      organization_id: u.organization_id || u.org_id || '',
      phone: u.phone || '',
      password: ''
    });
    setOpen(true);
  }

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCreateOrUpdate(e: FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        organization_id: form.organization_id || undefined,
        phone: form.phone || undefined,
        password: form.password || undefined
      };

      if (editId) {
        await updateUser(token, editId, payload);
        showToast('User updated successfully');
      } else {
        await createUser(token, payload);
        showToast('User created successfully');
      }

      setOpen(false);
      resetForm();
      const newUsers = await listUsers(token);
      setUsers(newUsers);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save user');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deleteUser(token, deleteId);
      setDeleteId(null);
      showToast('User deleted');
      setUsers(await listUsers(token));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to delete user');
    } finally { setSaving(false); }
  }

  // Separate active from deleted
  const activeUsers  = users.filter(u => !u.is_deleted);
  const deletedUsers = users.filter(u => u.is_deleted);

  // Grouping logic
  const groupedUsers = useMemo(() => {
    let filtered = activeUsers;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }

    const groups: Record<string, typeof users> = {
      health: [],
      fire: [],
      police: [],
      other: [],
      unassigned: []
    };

    const orgMap: Record<string, string> = {};
    orgs.forEach(o => {
      const type = (o.type || '').toLowerCase();
      if (type.includes('police')) orgMap[o.id] = 'police';
      else if (type.includes('fire')) orgMap[o.id] = 'fire';
      else if (type.includes('hospital') || type.includes('ambulance') || type.includes('health') || type.includes('clinic')) orgMap[o.id] = 'health';
      else orgMap[o.id] = 'other';
    });

    filtered.forEach(u => {
      if (!u.organization_id || !orgMap[u.organization_id]) {
        groups['unassigned'].push(u);
      } else {
        groups[orgMap[u.organization_id]].push(u);
      }
    });

    return groups;
  }, [activeUsers, orgs, searchTerm]);

  const columns: Column<any>[] = [
    { key: 'name',  label: 'Name',         render: u => <span style={{ fontWeight: '500' }}>{u.name}</span> },
    { key: 'email', label: 'Email',         render: u => <span style={{ color: 'var(--color-text-secondary)' }}>{u.email}</span> },
    { key: 'phone', label: 'Phone',         render: u => <span style={{ color: 'var(--color-text-secondary)' }}>{u.phone || '—'}</span> },
    { key: 'role',  label: 'Role',          render: u => <RolePill role={u.role} /> },
    { key: 'status',label: 'Status', width: '90px', render: u => (
        <Badge appearance="tint" color={u.is_active ? 'success' : 'subtle'} size="small">
          {u.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    { key: 'actions', label: '', width: '80px', render: u => (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <Button appearance="transparent" icon={<EditRegular fontSize={16} />} onClick={() => handleEdit(u)} title="Edit user" />
          <Button appearance="transparent" icon={<DeleteRegular fontSize={16} />} onClick={() => setDeleteId(u.id)} style={{ color: currentUser?.id === u.id ? 'var(--color-text-muted)' : 'var(--color-fire)' }} disabled={currentUser?.id === u.id} title="Delete user" />
        </div>
      )
    }
  ];

  const hasOrgs = orgs.length > 0;

  async function handleRestore(id: string) {
    setSaving(true);
    try {
      await restoreUser(token, id);
      showToast('User restored');
      setUsers(await listUsers(token, showDeleted));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to restore user');
    } finally { setSaving(false); }
  }

  async function handleHardDelete() {
    if (!hardDeleteId) return;
    setSaving(true);
    try {
      await hardDeleteUser(token, hardDeleteId);
      setHardDeleteId(null);
      showToast('User permanently deleted');
      setUsers(await listUsers(token, showDeleted));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to permanently delete user');
    } finally { setSaving(false); }
  }

  async function handleToggleShowDeleted() {
    const next = !showDeleted;
    setShowDeleted(next);
    setLoading(true);
    try {
      const u = await listUsers(token, next);
      setUsers(u);
    } finally { setLoading(false); }
  }

  if (!mounted) return null;
  if (!currentUser || currentUser.role !== 'system_admin') return null;

  return (
    <PageShell
      title="Users"
      subtitle={`${activeUsers.length} account${activeUsers.length !== 1 ? 's' : ''}${deletedUsers.length > 0 ? ` · ${deletedUsers.length} deleted` : ''}`}
      loading={loading}
      actions={
        <div style={{ display: 'flex', gap: '12px' }}>
          <Input 
            contentBefore={<SearchRegular />}
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ minWidth: '220px' }}
          />
          <Button appearance={showDeleted ? 'primary' : 'outline'} onClick={handleToggleShowDeleted} style={showDeleted ? { background: 'var(--color-text-muted)', border: 'none' } : {}}>
            {showDeleted ? 'Hide deleted' : 'Show deleted'}
          </Button>
          <Button appearance="primary" icon={<AddRegular />} style={{ background: 'var(--color-accent)', border: 'none' }} onClick={() => { resetForm(); setOpen(true); }}>
            Add user
          </Button>
        </div>
      }
    >
      {pageError ? <ErrorState message={pageError} onRetry={loadData} /> : <>
      {/* Unassigned / System Admins */}
      {groupedUsers['unassigned']?.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className={styles.groupHeader}>
            <FlowchartRegular fontSize={18} style={{ color: 'var(--color-brand)' }} />
            <Text className={styles.groupTitle}>System Administrators & Unassigned</Text>
            <span className={styles.groupCount}>{groupedUsers['unassigned'].length} users</span>
          </div>
          <PaginatedUserTable columns={columns} rows={groupedUsers['unassigned']} />
        </div>
      )}

      {/* Category Groups */}
      {[
        { key: 'health', title: 'Health & Medical Services' },
        { key: 'fire', title: 'Fire Departments' },
        { key: 'police', title: 'Police Departments' },
        { key: 'other', title: 'Other Organizations' }
      ].map(category => {
        const categoryUsers = groupedUsers[category.key] || [];
        if (categoryUsers.length === 0) return null; // Hide empty groups
        return (
          <div key={category.key} style={{ marginBottom: '32px' }}>
            <div className={styles.groupHeader}>
              <BuildingRegular fontSize={16} style={{ color: 'var(--color-text-secondary)' }} />
              <Text className={styles.groupTitle}>{category.title}</Text>
              <span className={styles.groupCount}>{categoryUsers.length} users</span>
            </div>
            <PaginatedUserTable columns={columns} rows={categoryUsers} />
          </div>
        );
      })}

      {!loading && activeUsers.length === 0 && (
        <EmptyState
          title="No users yet"
          description="Create call centre operator accounts and agency administrator accounts to get started."
        />
      )}

      {showDeleted && deletedUsers.length > 0 && (
        <div style={{ marginTop: '32px', marginBottom: '32px', opacity: 0.7 }}>
          <div className={styles.groupHeader}>
            <DeleteRegular fontSize={16} style={{ color: 'var(--color-fire)' }} />
            <Text className={styles.groupTitle} style={{ color: 'var(--color-fire)' }}>Deleted accounts</Text>
            <span className={styles.groupCount}>{deletedUsers.length} accounts</span>
          </div>
          <DataTable
            columns={[
              { key: 'name',       label: 'Name',    render: u => <span style={{ fontWeight: '500', textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>{u.name}</span> },
              { key: 'email',      label: 'Email',   render: u => <span style={{ color: 'var(--color-text-muted)' }}>{u.email}</span> },
              { key: 'role',       label: 'Role',    render: u => <RolePill role={u.role} /> },
              { key: 'deleted_at', label: 'Deleted', render: u => <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{u.deleted_at ? new Date(u.deleted_at).toLocaleDateString() : '—'}</span> },
              { key: 'actions',    label: '',        width: '100px', render: u => (
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                  <Button appearance="transparent" icon={<ArrowResetRegular fontSize={16} />} onClick={() => handleRestore(u.id)} title="Restore account" style={{ color: 'var(--color-medical)' }} disabled={saving} />
                  <Button appearance="transparent" icon={<DeleteDismissRegular fontSize={16} />} onClick={() => setHardDeleteId(u.id)} title="Permanently delete" style={{ color: 'var(--color-fire)' }} disabled={saving} />
                </div>
              )},
            ]}
            rows={deletedUsers}
            rowKey={u => u.id}
          />
        </div>
      )}

      {/* Edit/Create Modal */}
      <Dialog open={open} onOpenChange={(_, d) => { setOpen(d.open); if(!d.open) resetForm(); }}>
        <DialogSurface style={{ maxWidth: '440px' }}>
          <form onSubmit={handleCreateOrUpdate}>
            <DialogTitle>{editId ? 'Edit user' : 'Add user'}</DialogTitle>
            <DialogBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px', marginTop: '12px' }}>
                <Field label="Full name" required>
                  <Input value={form.name} onChange={e => setField('name', e.target.value)} required autoFocus />
                  {nameError && <Text style={{ color: 'var(--color-text-error, #D13438)', fontSize: '12px', marginTop: '2px' }}>{nameError}</Text>}
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} required disabled={!!editId} />
                  {emailError && <Text style={{ color: 'var(--color-text-error, #D13438)', fontSize: '12px', marginTop: '2px' }}>{emailError}</Text>}
                </Field>                  {!!editId && (
                    <Field label="New Password (optional)">
                      <Input type="password" value={form.password || ''} onChange={e => setField('password', e.target.value)} placeholder="Leave blank to keep current password" />
                    </Field>
                  )}                {/* Optional Phone Field */}
                <Field label="Phone number">
                  <Input type="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+233 ..." />
                </Field>
                <Field label="Role" required>
                  <Select value={form.role} onChange={e => setField('role', e.target.value)}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    {currentUser?.role === 'system_admin' && <option value="system_admin">system admin</option>}
                  </Select>
                </Field>
                <Field label="Organisation">
                  <Select value={form.organization_id} onChange={e => setField('organization_id', e.target.value)}>
                    <option value="">— None —</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                  {orgError && <Text style={{ color: 'var(--color-text-error, #D13438)', fontSize: '12px', marginTop: '2px' }}>{orgError}</Text>}
                </Field>
                {error && <Text style={{ color: 'var(--color-fire)', fontSize: '13px' }}>{error}</Text>}
                {!editId && (
                  <Text style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    A temporary password will be emailed to the user.
                  </Text>
                )}
              </div>
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" appearance="primary" disabled={saving || !formValid} style={{ background: 'var(--color-accent)', border: 'none' }}>
                {saving ? <Spinner size="tiny" /> : 'Save user'}
              </Button>
            </DialogActions>
          </form>
        </DialogSurface>
      </Dialog>
      
      {/* Soft Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(_, d) => { if (!d.open) setDeleteId(null); }}>
        <DialogSurface>
          <DialogTitle>Confirm deletion</DialogTitle>
          <DialogBody>
            Are you sure you want to delete this user? They will immediately lose access to the system.
          </DialogBody>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setDeleteId(null)} disabled={saving}>Cancel</Button>
            <Button appearance="primary" onClick={handleDelete} disabled={saving} style={{ background: 'var(--color-fire)', color: 'white' }}>
              {saving ? <Spinner size="tiny" /> : 'Delete user'}
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>

      {/* Hard Delete Confirmation */}
      <Dialog open={!!hardDeleteId} onOpenChange={(_, d) => { if (!d.open) setHardDeleteId(null); }}>
        <DialogSurface>
          <DialogTitle>Permanently delete user</DialogTitle>
          <DialogBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span>This will <strong>permanently remove</strong> the user from the database. This action cannot be undone.</span>
              <span style={{ fontSize: '12px', color: 'var(--color-fire)' }}>All audit records referencing this user will remain but the account will be unrecoverable.</span>
            </div>
          </DialogBody>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setHardDeleteId(null)} disabled={saving}>Cancel</Button>
            <Button appearance="primary" onClick={handleHardDelete} disabled={saving} style={{ background: 'var(--color-fire)', color: 'white' }}>
              {saving ? <Spinner size="tiny" /> : 'Permanently delete'}
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </>
      }
    </PageShell>
  );
}
