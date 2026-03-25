const fs = require('fs');
const pagePath = 'frontend/web/src/app/(field)/field/page.tsx';
let p = fs.readFileSync(pagePath, 'utf8');

p = p.replace(\"import { SignOutRegular, AlertUrgentRegular } from '@fluentui/react-icons';\", \"import { SignOutRegular, AlertUrgentRegular, PersonRegular } from '@fluentui/react-icons';\");

p = p.replace(\"<Button\\n          appearance=\\\"transparent\\\"\\n          icon={<SignOutRegular />}\\n          onClick={handleLogout}\\n          aria-label=\\\"Sign out\\\"\\n        />\", 
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
