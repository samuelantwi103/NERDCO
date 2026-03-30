
import re

with open('src/app/(field)/field/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make the Dashboard's bottomSheet respectful of larger screens
code = re.sub(
    r'bottomSheet: \{.*?(?=padding: \'16px\')',
    '''bottomSheet: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      zIndex: 10,
      background: 'var(--color-surface)',
      borderTopLeftRadius: '20px',
      borderTopRightRadius: '20px',
      maxWidth: '500px', margin: '0 auto',
      ''',
    code, flags=re.DOTALL
)

with open('src/app/(field)/field/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

