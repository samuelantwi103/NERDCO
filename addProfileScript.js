const fs = require('fs');
const pagePath = 'frontend/web/src/app/(field)/field/page.tsx';
let p = fs.readFileSync(pagePath, 'utf8');

p = p.replace('SignOutRegular, AlertUrgentRegular }', 'SignOutRegular, AlertUrgentRegular, PersonRegular }');

p = p.replace('<Button\\n          appearance=\"transparent\"\\n          icon={<SignOutRegular />}\\n          onClick={handleLogout}\\n          aria-label=\"Sign out\"\\n        />', 
\<div style={{ display: 'flex', gap: '4px' }}>
          <Button
            appearance="transparent"
            icon={<PersonRegular />}
            onClick={() => router.push('/field/profile')}
            aria-label="Profile"
          />
          <Button
            appearance="transparent"
            icon={<SignOutRegular />}
            onClick={handleLogout}
            aria-label="Sign out"
          />
        </div>\);

fs.writeFileSync(pagePath, p);
