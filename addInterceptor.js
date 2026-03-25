const fs = require('fs');
const path = 'frontend/web/src/lib/context/AuthContext.tsx';
let p = fs.readFileSync(path, 'utf8');

if (!p.includes('axios.interceptors.response')) {
  p = p.replace('// Keep sessionStorage and the role cookie in sync whenever user changes',
\// Axios interceptor to catch 401 responses and automatically log out
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
          setUser(null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Keep sessionStorage and the role cookie in sync whenever user changes\);
  
  fs.writeFileSync(path, p);
  console.log('Added interceptor');
}
