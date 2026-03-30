import { useState, FormEvent, useEffect } from 'react';
import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, Button, Field, Input, Text, Spinner } from '@fluentui/react-components';
import { updateProfile } from '@/lib/api/auth';
import { useAuth } from '@/lib/context/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileModal({ open, onOpenChange }: Props) {
  const { user, updateUser } = useAuth();
  const token = user?.access_token ?? '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPassword('');
      setError('');
      setSuccess('');
    }
  }, [open, user]);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);
    
    try {
      const payload: any = { name, email };
      if (password) payload.password = password;
      
      const res = await updateProfile(token, payload);
      updateUser({ name: res.user?.name ?? name, email: res.user?.email ?? email });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogSurface>
        <form onSubmit={handleUpdate}>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>
              <Text style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Update your personal information below. Ensure to save your password in a safe place.
              </Text>
              
              <Field label="Full Name" required>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </Field>
              
              <Field label="Email Address" required>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </Field>
              
              <Field label="New Password">
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep current password" />
              </Field>

              {error && <Text style={{ color: 'var(--color-fire)', fontSize: '13px' }}>{error}</Text>}
              {success && <Text style={{ color: 'var(--color-success)', fontSize: '13px' }}>{success}</Text>}
            </div>
          </DialogBody>
          <DialogActions>
            <Button appearance="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" appearance="primary" disabled={saving} style={{ background: 'var(--color-accent)', border: 'none' }}>
              {saving ? <Spinner size="tiny" /> : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
