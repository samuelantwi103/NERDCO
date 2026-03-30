
import re

with open('src/app/(field)/field/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Just find cardHeader and inject incidentCard before it.
text = text.replace('  cardHeader:', '  incidentCard: { background: \'var(--color-surface-variant)\', borderRadius: \'8px\', padding: \'16px\', display: \'flex\', flexDirection: \'column\', gap: \'8px\', cursor: \'pointer\' },\n  cardHeader:')

with open('src/app/(field)/field/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

