import re

with open('src/app/(field)/field/incident/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add standard Fluent icons
import_old = "import { ArrowLeftRegular } from '@fluentui/react-icons';"
import_new = "import { ArrowLeftRegular, ArrowTurnRightRegular, ArrowTurnLeftRegular, ArrowUpRegular } from '@fluentui/react-icons';"
text = text.replace(import_old, import_new)

# Add helper function for icons
hook_pattern = "const popupRef        = useRef<HTMLElement | null>(null);"
hook_insert = """const popupRef        = useRef<HTMLElement | null>(null);

  const getManeuverIcon = (maneuver?: string) => {
    if (!maneuver) return <ArrowUpRegular fontSize={32} />;
    if (maneuver.includes('right')) return <ArrowTurnRightRegular fontSize={32} />;
    if (maneuver.includes('left')) return <ArrowTurnLeftRegular fontSize={32} />;
    return <ArrowUpRegular fontSize={32} />;
  };"""
text = text.replace(hook_pattern, hook_insert)

# Use icon in render
nav_old = "{/* Arrow Icon Placeholder */}"
nav_new = "{getManeuverIcon(navInfo.maneuver)}"
text = text.replace(nav_old, nav_new)

with open('src/app/(field)/field/incident/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Icon patch complete")
