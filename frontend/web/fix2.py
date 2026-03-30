import re
with open('src/app/(fleet)/fleet/capacity/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

pos1 = text.find('cardHeader: {')
pos2 = text.find('cardTitle:', pos1)

if pos1 != -1 and pos2 != -1:
    new_text = text[:pos1] + '''cardHeader: {
    padding: '16px 20px',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  ''' + text[pos2:]
    with open('src/app/(fleet)/fleet/capacity/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_text)
