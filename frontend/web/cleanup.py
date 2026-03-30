import re

with open('src/app/(field)/field/incident/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "  const [popupOpen, setPopupOpen] = useState(true);\n  const [popupOpen, setPopupOpen] = useState(true);",
    "  const [popupOpen, setPopupOpen] = useState(true);"
)

# Remove the SECOND legend (the original one)
# Wait, let's just regex out the second one.
legend_pattern = r"  legend: \{\n    position: 'absolute', bottom: '12px', left: '12px',\n    background: 'rgba\(255,255,255,0\.95\)', border: '1px solid #e0e0e0',\n.*?\n  \},"
text = re.sub(legend_pattern, "", text, flags=re.DOTALL)

with open('src/app/(field)/field/incident/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Cleanup complete")
