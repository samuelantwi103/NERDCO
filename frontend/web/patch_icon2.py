import re

with open('src/app/(field)/field/incident/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "import { ArrowLeftRegular, ArrowTurnRightRegular, ArrowTurnLeftRegular, ArrowUpRegular } from '@fluentui/react-icons';",
    "import { ArrowLeftRegular, ArrowTurnRightRegular, ArrowTurnLeftUpRegular as ArrowTurnLeftRegular, ArrowUpRegular } from '@fluentui/react-icons';"
)

with open('src/app/(field)/field/incident/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Icon patch 2 complete")
