# HygieneTech Site Survey

Mobile web app for the **Corporate Office Housekeeping Scoping Checklist**.

- Step-by-step survey form (sections A–R)
- Downloads a PDF report with the HygieneTech logo
- Saves every PDF into `submitted-pdfs/` (when using the local server)
- Emails the **PDF attachment** to **info@hygienetech.in**

## Live website

**Vercel:** https://site-survey-gamma.vercel.app  

**Repo:** https://github.com/Jaymehta45/hygienetech-site-survey

## Recommended: run locally (saves PDFs into the project folder)

```bash
cd site-survey
npm install
npm start
```

Open http://localhost:5180

Every completed survey PDF is stored in:

`site-survey/submitted-pdfs/`

## Email

By default the server emails the PDF via FormSubmit.

For more reliable delivery, copy `.env.example` → `.env` and set SMTP:

```bash
cp .env.example .env
```

Optional: set `GITHUB_TOKEN` so production (Vercel) can also write PDFs into the repo’s `submitted-pdfs/` folder.

## One-time FormSubmit activation

If email doesn’t arrive, check `info@hygienetech.in` for a FormSubmit activation link and confirm once.
