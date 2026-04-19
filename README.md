# GitHub Repo Sync Automation (Node.js)

שרת Node.js עם ממשק ויזואלי שמבצע:

1. משיכת תוכן מריפו מקור ב-GitHub.
2. יצירת סניף חדש בריפו יעד.
3. העתקת תוכן המקור ליעד.
4. יצירת commit ו-push לסניף החדש.

## דרישות

- Node.js 20+
- Git מותקן על השרת
- GitHub Token עם הרשאות ל-2 הריפוזיטוריז (לרוב `repo`)

## התקנה

```bash
npm install
cp .env.example .env
npm start
```

השרת עולה בכתובת:

- `http://localhost:3000`

## הגדרת משתני סביבה

```env
PORT=3000
GITHUB_TOKEN=
GIT_AUTHOR_NAME=repo-sync-bot
GIT_AUTHOR_EMAIL=repo-sync-bot@users.noreply.github.com
```

אפשר להעביר token דרך הטופס, או להשתמש ב-`GITHUB_TOKEN` בשרת.

## שימוש

בממשק תמלא:

- Source Repo: `owner/source-repo`
- Source Branch: `main`
- Target Repo: `owner/target-repo`
- Target Base Branch: `main`
- New Branch Name: למשל `sync/source-main-2026-04-19`
- Commit Message (אופציונלי)
- GitHub Token (אופציונלי)

לחיצה על "הרץ סנכרון" תבצע את כל השלבים ותציג לוגים.

## הערות אבטחה

- עדיף לא לשלוח token מהדפדפן אלא להגדיר בשרת (`GITHUB_TOKEN`).
- מומלץ להשתמש ב-fine-grained token עם ההרשאות המינימליות.
