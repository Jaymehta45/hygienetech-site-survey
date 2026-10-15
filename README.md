# HygieneTech Site Survey

Mobile web app for the **Corporate Office Housekeeping Scoping Checklist**.

- Step-by-step survey form (sections A–R)
- Generates a PDF report with the HygieneTech logo
- Emails the PDF to **info@hygienetech.in** on every generate
- Also downloads a local copy on the device

## Live website

**Vercel:** https://site-survey-gamma.vercel.app

**GitHub Pages:** https://jaymehta45.github.io/hygienetech-site-survey/

**Repo:** https://github.com/Jaymehta45/hygienetech-site-survey

## Local run

```bash
python3 -m http.server 5180
```

Open http://localhost:5180

## Email activation (one-time)

Email uses [FormSubmit](https://formsubmit.co). The **first** submission sends an activation link to `info@hygienetech.in`. Click it once — after that, every PDF is emailed automatically.
