const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

if (!code.includes('ProfileModal')) {
  // inject import
  code = "import { ProfileModal } from '@/components/ProfileModal';\n" + code;
  
  // inject state
  code = code.replace(/const path = usePathname\(\);/, "const path = usePathname();\n  const [profileOpen, setProfileOpen] = useState(false);");
  code = code.replace(/import { usePathname, useRouter } from 'next\/navigation';/, "import { usePathname, useRouter } from 'next/navigation';\nimport { useState } from 'react';");
  
  // inject modal and change onClick of userRow
  code = code.replace(
    /className=\{styles\.userRow\}/g,
    'className={styles.userRow} onClick={() => setProfileOpen(true)} style={{cursor: "pointer", transition: "background 150ms", borderRadius: "5px"}} onMouseEnter={e => e.currentTarget.style.background = "var(--color-bg)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}'
  );
  
  // place ProfileModal near bottom
  code = code.replace(
    /<\/nav>/g,
    "  <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />\n    </nav>"
  );
  
  fs.writeFileSync('src/components/layout/Sidebar.tsx', code);
  console.log('updated sidebar');
}
