import sys

with open('src/components/layout/Sidebar.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    \"if (item.href === '/fleet/vehicles' || item.href === '/fleet/staff') return orgType !== 'hospital';\",
    \"// Hospitals can manage their own vehicles and staff too\"
)

with open('src/components/layout/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
