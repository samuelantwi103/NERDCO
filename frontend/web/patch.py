import re

with open(r'c:\Users\samuel\Documents\education\CPEN 421 - Mobile and Web Software Design\Labs\Course_Project\backend\auth-service\src\utils\emailService.ts', 'r', encoding='utf-8') as f:
    text = f.read()

old_str = "const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';"
new_str = "const frontendUrl = process.env.FRONTEND_URL || 'https://nerdco-app.onrender.com';"

if old_str in text:
    text = text.replace(old_str, new_str)
    with open(r'c:\Users\samuel\Documents\education\CPEN 421 - Mobile and Web Software Design\Labs\Course_Project\backend\auth-service\src\utils\emailService.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Success auth service")
else:
    print("Not found auth service")

