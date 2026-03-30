import re

with open(r'c:\Users\samuel\Documents\education\CPEN 421 - Mobile and Web Software Design\Labs\Course_Project\backend\auth-service\.env.example', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('FRONTEND_URL=http://localhost:3000', 'FRONTEND_URL=https://nerdco-app.onrender.com')

with open(r'c:\Users\samuel\Documents\education\CPEN 421 - Mobile and Web Software Design\Labs\Course_Project\backend\auth-service\.env.example', 'w', encoding='utf-8') as f:
    f.write(text)

