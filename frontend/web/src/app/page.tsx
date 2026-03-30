import { redirect } from 'next/navigation';

// Root → always redirect to login; middleware handles role-based routing from there.
export default function RootPage() {
  redirect('/login');
}
