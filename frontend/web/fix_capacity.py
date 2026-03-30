import re

with open('src/app/(fleet)/fleet/capacity/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r"maxWidth: '800px',[\s\S]*?gap: '32px'", "maxWidth: '800px',\n    margin: '0 auto',\n    display: 'flex',\n    flexDirection: 'column',\n    gap: '24px'", text)
text = text.replace("boxShadow: 'var(--shadow-md)',", "boxShadow: 'var(--shadow-xs)',")
text = re.sub(r"padding: '32px',\s*background: 'linear-gradient[^,]*,(\s*)borderBottom", r"padding: '16px 24px',\n    background: 'var(--color-surface)',\g<1>borderBottom", text)
text = re.sub(r"padding: '32px',[\s\S]*?gap: '40px'", "padding: '24px',\n    display: 'flex',\n    flexDirection: 'column',\n    gap: '24px'", text)
text = text.replace("fontWeight: '800', fontSize: '24px', letterSpacing: '-0.02em'", "fontWeight: '600', fontSize: '18px', letterSpacing: '0'")
text = text.replace("fontWeight: '800', fontSize: '20px'", "fontWeight: '600', fontSize: '18px'")
text = text.replace("fontSize: '28px', fontWeight: '800'", "fontSize: '20px', fontWeight: '600'")
text = text.replace("fontWeight: '700', fontSize: '14px'", "fontWeight: '600', fontSize: '13px'")
text = text.replace("height: '64px'", "height: '42px'")

with open('src/app/(fleet)/fleet/capacity/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
