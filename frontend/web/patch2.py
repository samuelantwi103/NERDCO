import re

with open("src/app/(field)/field/incident/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

pattern_top = r"navTopBox: \{\s*position: 'absolute', top: '12px', left: '12px', right: '12px',\s*background: '#0d4722', color: '#fff', borderRadius: '12px', padding: '12px 16px',\s*display: 'flex', alignItems: 'center', gap: '12px',\s*boxShadow: '0 4px 12px rgba\(0,0,0,0\.3\)', zIndex: 100,\s*maxWidth: '500px', margin: '0 auto'\s*\}"

new_top = """navTopBox: {
      position: 'absolute', top: '12px', left: '12px', right: '12px',
      background: '#0d4722', color: '#fff', borderRadius: '12px', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100,
      maxWidth: '500px', margin: '0 auto',
      '@media (min-width: 768px)': {
        left: '24px', right: 'auto', top: '24px', margin: 0, width: '400px'
      }
    }"""

pattern_bottom = r"bottomPanel: \{\s*position: 'absolute', bottom: 0, left: 0, right: 0,\s*background: 'var\(--color-surface\)', borderTopLeftRadius: '24px',\s*borderTopRightRadius: '24px', zIndex: 200,\s*boxShadow: '0 -8px 24px rgba\(0,0,0,0\.15\)',\s*display: 'flex', flexDirection: 'column',\s*height: 'auto', maxHeight: '60vh', transition: 'transform 0\.3s cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)',\s*maxWidth: '500px', margin: '0 auto'\s*\}"

new_bottom = """bottomPanel: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'var(--color-surface)', borderTopLeftRadius: '24px',
      borderTopRightRadius: '24px', zIndex: 200,
      boxShadow: '0 -8px 24px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      height: 'auto', maxHeight: '60vh', transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      maxWidth: '500px', margin: '0 auto',
      '@media (min-width: 768px)': {
        left: '24px', right: 'auto', bottom: '24px', margin: 0, width: '400px',
        borderRadius: '24px', maxHeight: 'calc(100vh - 120px)'
      }
    }"""

text = re.sub(pattern_top, new_top, text, flags=re.DOTALL)
text = re.sub(pattern_bottom, new_bottom, text, flags=re.DOTALL)

with open("src/app/(field)/field/incident/page.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Done")
