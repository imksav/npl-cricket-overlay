# Live Cricket Broadcast Overlay — Vercel Project

A Vercel-ready cricket overlay project based on the original HTML overlay supplied for this project. It includes a match control centre, a server-side CricketData.org API proxy, and an OBS browser overlay.

## What is included

- `public/overlay.html` — original manual-scoring overlay design and controls, preserved.
- `public/admin.html` + `public/admin.js` — control centre to load and select matches returned by CricketData.org.
- `public/overlay-api.js` — updates the existing overlay's visible score fields when a match is selected in API mode.
- `api/matches.js` — server-side API proxy. Your private API key stays on the server.
- `vercel.json` — routes `/` to the control centre and `/overlay` to the overlay.

## Important: API coverage and limits

The integration uses CricketData.org's `currentMatches` endpoint. It can only display matches and fields that this provider returns for your account. **Nepal Premier League (NPL) coverage is not guaranteed**; check that an NPL fixture appears in the control centre before relying on it for a broadcast.

The `currentMatches` response does not necessarily include ball-by-ball commentary, complete scorecards, current batter/bowler statistics, player photos, or every tournament fixture. Those details are not invented by this project. The existing manual-scoring mode remains available by opening `/overlay.html` without a `matchId` parameter.

Check your provider plan, quota, data delay and broadcast/display permissions directly with CricketData.org. A free quota may be too limited for frequent live refreshes. The default control-centre interval is 15 minutes to reduce API usage; select a faster interval only if your plan supports it.

## 1. Requirements

- Windows 10/11, macOS or Linux
- Node.js 18 or newer (npm is included)
- A GitHub account
- A Vercel account
- A CricketData.org account and API key for API mode
- OBS Studio for broadcasting (optional during development)

No Next.js, React, or database installation is required.

## 2. Run locally (Windows PowerShell)

1. Extract this ZIP file.
2. Open the extracted `npl-cricket-overlay` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run:

   ```powershell
   npm install
   Copy-Item .env.example .env.local
   ```

5. Open `.env.local` and replace the placeholder with your private key:

   ```env
   CRICKET_API_KEY=your_actual_private_key
   ```

6. Start the local Vercel development server:

   ```powershell
   npx vercel dev
   ```

7. Open `http://localhost:3000` in your browser. The control centre should load. The manual overlay can be opened at `http://localhost:3000/overlay.html`.

You can inspect JavaScript syntax with `npm run check`.

## 3. Upload to GitHub

Create an empty GitHub repository. Upload the **contents** of this project folder, not an extra enclosing folder. At the top level of the GitHub repository, you should see:

```text
api/
  matches.js
public/
  admin.html
  admin.js
  overlay.html
  overlay-api.js
package.json
vercel.json
.env.example
.gitignore
README.md
```

Do not upload `.env.local`, your API key, `node_modules`, or `.vercel`.

## 4. Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Set **Framework Preset** to **Other**.
3. Set **Root Directory** to `.` (the repository root, where `package.json` and `vercel.json` are located).
4. Do not use a Next.js build command. Leave **Build Command** empty / disabled.
5. Set **Output Directory** to `public` if Vercel asks for one. Keep the `api` directory at the project root so Vercel can detect the serverless function.
6. Deploy.

If Vercel's deployment settings differ from these options, check that the selected Root Directory is the folder containing both `package.json` and `vercel.json`.

## 5. Add the API key in Vercel

After importing the project:

1. Open **Project → Settings → Environment Variables**.
2. Add `CRICKET_API_KEY` with your CricketData.org API key as its value.
3. Apply it to Production (and Preview/Development if needed).
4. Save, then redeploy so the function receives the new variable.

Optional settings:

```env
CRICKET_API_BASE_URL=https://api.cricapi.com/v1
CRICKET_API_MATCHES_ENDPOINT=currentMatches
```

Do not put the API key in HTML, browser JavaScript, OBS URLs, screenshots, or GitHub. If a key is exposed, revoke/rotate it with the provider.

## 6. Use the application

- Control centre: `https://YOUR-PROJECT.vercel.app/`
- OBS overlay: select a match in the control centre and copy the generated URL. The direct route is `/overlay.html?matchId=MATCH_ID&refresh=900`.
- API health/data check: `https://YOUR-PROJECT.vercel.app/api/matches`
- Manual scoring overlay: `https://YOUR-PROJECT.vercel.app/overlay.html` (without `matchId`).

In OBS, add a **Browser** source, paste the generated overlay URL, and set the source dimensions to match your scene (commonly 1920 × 1080).

## 7. Before using it on a live broadcast

- Confirm `/api/matches` returns `ok: true` and a `matches` array.
- Confirm the intended NPL match appears in the returned matches.
- Compare the displayed score against the provider's official data.
- Test refresh timing and API quota with your actual provider plan.
- Test the overlay in OBS at your intended resolution.
- Confirm your API plan permits your intended broadcast/display use.

## Limitations / honest status

This is a deployable project package, not a guarantee that a provider will return every NPL match or every broadcast statistic. No live API key was supplied with this ZIP, so live provider connectivity and NPL coverage cannot be verified in advance. The manual scoring interface is retained as a fallback.
