'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Text, Button, Input, Field, Spinner, makeStyles
} from '@fluentui/react-components';
import { ArrowLeftRegular, EditRegular } from '@fluentui/react-icons';
import { useAuth } from '@/lib/context/AuthContext';
import { updateUser } from '@/lib/api/auth';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    padding: '24px 16px',
    gap: '24px',
    background: 'var(--color-bg)'
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--color-border)',
  },
  title: { fontWeight: '700', fontSize: '18px' },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }
});

export default function FirstResponderProfile() {
  const styles = useStyles();
  const router = useRouter();
  const { user, login } = useAuth(); // Need login to refresh token payload, ideally
  const token = user?.access_token ?? '';

  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user?.name) {
      setForm({ name: user.name });
    }
  }, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    
    setError(''); setSuccess(''); setSaving(true);
    try {
      await updateUser(token, user.id, { name: form.name });
      setSuccess('Profile updated successfully.');
      // Update local storage so useAuth picks it up on refresh, or let the user re-login
      // If we don't have a refresh function in useAuth, they will see it next login
      // For now, visual feedback is enough
    } catch(err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Button
          appearance="transparent"
          icon={<ArrowLeftRegular />}
          onClick={() => router.push('/field')}
          aria-label="Back"
          style={{ marginLeft: '-8px' }}
        />
        <Text className={styles.title}>My Profile</Text>
      </div>

      <div className={styles.card}>
        <Text style={{ fontWeight: '600', fontSize: '16px' }}>Account Settings</Text>
        <form onSubmit={handleSave} className={styles.formGroup}>
          <Field label="Full Name">
            <Input 
              value={form.name} 
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
              required
            />
          </Field>
          
          <Field label="Email Address">
            <Input value={user?.email || ''} disabled />
          </Field>
          
          <Field label="Role">
            <Input value={user?.role?.replace(/_/g, ' ') || ''} disabled />
          </Field>

          {error && <Text style={{ color: 'var(--color-fire)', fontSize: '13px' }}>{error}</Text>}
          {success && <Text style={{ color: 'var(--color-success)', fontSize: '13px' }}>{success}</Text>}

          <Button type="submit" appearance="primary" disabled={saving || !form.name || form.name === user?.name} style={{ background: 'var(--color-accent)', border: 'none', alignSelf: 'flex-start', marginTop: '8px' }}>
            {saving ? <Spinner size="tiny" /> : 'Save Changes'}
          </Button>
        </form>
      </div>
    </div>
  );
}
