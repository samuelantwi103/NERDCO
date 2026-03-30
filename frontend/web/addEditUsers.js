const fs = require('fs');

const code = `'use client';
import { useState, FormEvent, useMemo } from 'react';
import {
  Text, Button, Field, Input, Select, Spinner,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, Badge,
  makeStyles
} from '@fluentui/react-components';
import { AddRegular, EditRegular, DeleteRegular, BuildingRegular, FlowChartRegular, SearchRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { listUsers, createUser, updateUser, deleteUser, listOrganizations } from '@/lib/api/auth';
import { PageShell } from '@/components/ui/PageShell';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';

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

export default function UsersPage() {
  const styles = useStyles();
  const { user: currentUser } = useAuth();
  const token = currentUser?.access_token ?? '';

  const [users,    setUsers]    = useState<any[]>([]);
  const [orgs,     setOrgs]     = useState<any[]>([]);
  
  // Modals
  const [open,     setOpen]     = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'first_responder', organization_id: '', phone: '' });

  useAutoRefresh(async () => {
    try {
      const [u, o] = await Promise.all([listUsers(token), listOrganizations(token)]);
      setUsers(u);
      setOrgs(o);
    } finally { setLoading(false); }
  }, 60_000);

  function resetForm() {
    setEditId(null);
    setForm({ name: '', email: '', role: 'first_responder', organization_id: '', phone: '' });
    setError('');
  }

  function handleEdit(u: any) {
    setEditId(u.id);
    setForm({ 
      name: u.name || '', 
      email: u.email || '', 
      role: u.role || 'first_responder', 
      organization_id: u.organization_id || '',
      phone: u.phone || ''
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
        phone: form.phone || undefined
      };
      
      if (editId) {
        await updateUser(token, editId, payload);
      } else {
        await createUser(token, payload);
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
      setUsers(await listUsers(token));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to delete user');
    } finally { setSaving(false); }
  }

  // Grouping logic
  const groupedUsers = useMemo(() => {
    let filtered = users;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }

    const groups: Record<string, typeof users> = {};
    
    // Default group for System Admins or users without an org
    groups['unassigned'] = [];

    // Initialize groups for all orgs
    orgs.forEach(o => { groups[o.id] = []; });

    filtered.forEach(u => {
      if (u.organization_id && groups[u.organization_id]) {
        groups[u.organization_id].push(u);
      } else {
        groups['unassigned'].push(u);
      }
    });

    return groups;
  }, [users, orgs, searchTerm]);

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
  
  return (
    <PageShell
      title="Users"
      subtitle={\`\${users.length} account\${users.length !== 1 ? 's' : ''}\`}
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
          <Button appearance="primary" icon={<AddRegular />} style={{ background: 'var(--color-accent)', border: 'none' }} onClick={() => { resetForm(); setOpen(true); }}>
            Add user
          </Button>
        </div>
      }
    >
      
      {/* Unassigned / System Admins */}
      {groupedUsers['unassigned']?.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className={styles.groupHeader}>
            <FlowChartRegular fontSize={18} style={{ color: 'var(--color-brand)' }} />
            <Text className={styles.groupTitle}>System Administrators & Unassigned</Text>
            <span className={styles.groupCount}>{groupedUsers['unassigned'].length} users</span>
          </div>
          <DataTable
            columns={columns}
            rows={groupedUsers['unassigned']}
            rowKey={u => u.id}
          />
        </div>
      )}

      {/* Organisation Groups */}
      {orgs.map(org => {
        const orgUsers = groupedUsers[org.id] || [];
        if (orgUsers.length === 0) return null; // Hide empty orgs
        return (
          <div key={org.id} style={{ marginBottom: '32px' }}>
            <div className={styles.groupHeader}>
              <BuildingRegular fontSize={16} style={{ color: 'var(--color-text-secondary)' }} />
              <Text className={styles.groupTitle}>{org.name}</Text>
              <span className={styles.groupCount}>{orgUsers.length} users</span>
            </div>
            <DataTable
              columns={columns}
              rows={orgUsers}
              rowKey={u => u.id}
            />
          </div>
        );
      })}

      {!loading && users.length === 0 && (
        <EmptyState 
          title="No users yet" 
          description="Create call centre operator accounts and agency administrator accounts to get started." 
        />
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
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} required disabled={!!editId} />
                </Field>
                {/* Optional Phone Field */}
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
              <Button type="submit" appearance="primary" disabled={saving} style={{ background: 'var(--color-accent)', border: 'none' }}>
                {saving ? <Spinner size="tiny" /> : 'Save user'}
              </Button>
            </DialogActions>
          </form>
        </DialogSurface>
      </Dialog>
      
      {/* Delete Confirmation */}
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
    </PageShell>
  );
}
`;
fs.writeFileSync('src/app/(ops)/admin/users/page.tsx', code);
console.log('Saved addEditUsers.tsx');