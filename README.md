# Dhaurahara Abadkari Gram Vikas Portal

यह V1 production foundation है।

## Structure

- `index.html` — public website
- `assets/css/style.css` — premium responsive design
- `assets/js/app.js` — frontend API, complaint tracking, public data
- `backend/Code.gs` — Google Apps Script backend
- `backend/appsscript.json` — Apps Script manifest

## Step 1 — Google Sheet बनाएं

एक नई Google Sheet बनाएं, फिर Extensions → Apps Script खोलें।

`backend/Code.gs` का पूरा code paste करें।

Apps Script editor में `setupProject()` function एक बार Run करें और permissions allow करें।

यह sheets बनाएगा:
- Settings
- Works
- Issues
- Notices
- Contacts
- Pradhans

## Step 2 — Apps Script Web App deploy करें

Apps Script:
Deploy → New deployment → Web app

- Execute as: Me
- Who has access: Anyone

Deploy के बाद `/exec` वाला Web App URL copy करें।

## Step 3 — Frontend connect करें

Frontend backend से connect कर दिया गया है:

```js
API_URL: "https://script.google.com/macros/s/AKfycbyvoSrqR0x3ZPXz8hO6keyJRLvY0FswtJziwUFLW_JbkibLIYeBTrl-nijL3YJ7msMvoA/exec"
```

## Step 4 — GitHub Pages

GitHub → Settings → Pages → Deploy from branch → main / root

## Data publish rules

### Works
`Published` = TRUE होने पर ही website पर दिखेगा।

### Issues
नई public submission:
- Status = Pending Verification
- Published = FALSE

Admin Sheet में verify करके `Published` = TRUE करें और Status/LatestUpdate update करें।

### Contacts
केवल `Public` = TRUE contacts website पर दिखेंगे।

### Notices
केवल `Active` = TRUE notices ticker में दिखेंगे।

## Important
यह portal अप्रमाणित व्यक्तिगत आरोप या sensitive personal data के लिए नहीं है।
