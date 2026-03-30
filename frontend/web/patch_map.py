import re

with open('src/app/(ops)/dashboard/DashboardMap.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(
    r\"const topLevelIncidents = incidents\.filter[^\n]+;\",
    \"\"\"const topLevelMap = new Map();
  incidents.forEach(i => {
    const pId = i.parent_incident_id || i.id;
    if (!topLevelMap.has(pId)) topLevelMap.set(pId, i);
    else if (!i.parent_incident_id) topLevelMap.set(i.id, i);
  });
  const topLevelIncidents = Array.from(topLevelMap.values());\"\"\",
    text
)

text = text.replace('i.assigned_vehicle_id', '(i.assigned_unit_id || i.assigned_vehicle_id)')

with open('src/app/(ops)/dashboard/DashboardMap.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
