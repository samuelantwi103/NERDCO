import re

with open("src/app/(field)/field/incident/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

pattern_bottom = r"'@media \(min-width: 768px\)': \{\s*left: '24px', right: 'auto', bottom: '24px', margin: 0, width: '400px',\s*borderRadius: '24px', maxHeight: 'calc\(100vh - 120px\)'\s*\}"

new_bottom = """'@media (min-width: 768px)': {
        left: '24px', right: 'auto', bottom: '24px', margin: 0, width: '400px',
        borderRadius: '24px', maxHeight: 'calc(100% - 120px)'
      }"""

text = re.sub(pattern_bottom, new_bottom, text, flags=re.DOTALL)

with open("src/app/(field)/field/incident/page.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Done")
