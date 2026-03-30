import re

with open(r'c:\Users\samuel\Documents\education\CPEN 421 - Mobile and Web Software Design\Labs\Course_Project\frontend\web\src\app\(field)\field\incident\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_str = "                {acting ? <Spinner size=\"small\" /> : 'Mark Resolved'}\n              </Button>\n              <Button"
new_str = "                {acting ? <Spinner size=\"small\" /> : 'Mark Resolved'}\n              </Button>\n            </div>\n              <Button"

if old_str in text:
    text = text.replace(old_str, new_str)
    print("Fixed missing div closing")
else:
    print("Not found fix 1")

with open(r'c:\Users\samuel\Documents\education\CPEN 421 - Mobile and Web Software Design\Labs\Course_Project\frontend\web\src\app\(field)\field\incident\page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
