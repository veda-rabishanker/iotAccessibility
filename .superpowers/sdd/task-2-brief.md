### Task 2: Rename app to Strider

**Files:**
- Modify: `app.json` (or `app.config.js` / `app.config.ts` if that is what the template created)
- Modify: `package.json` (`name` field only)

**Interfaces:**
- Consumes: Expo config from Task 1
- Produces: `expo.name` = `Strider`, `expo.slug` = `strider`, `expo.scheme` = `strider` (add `scheme` if missing), `package.json` name = `strider`

- [ ] **Step 1: Inspect the Expo config file the template created**

```powershell
Get-ChildItem app.json, app.config.* -ErrorAction SilentlyContinue
Get-Content .\app.json -ErrorAction SilentlyContinue
```

Expected: identify which config file exists and its current `name` / `slug` fields.

- [ ] **Step 2: Update Expo config**

If the file is `app.json`, set these fields under `expo` (keep all other template fields):

```json
{
  "expo": {
    "name": "Strider",
    "slug": "strider",
    "scheme": "strider"
  }
}
```

Do not change `ios.bundleIdentifier` or `android.package` in this pass if the template set defaults.

- [ ] **Step 3: Update package.json name**

Set:

```json
"name": "strider"
```

- [ ] **Step 4: Commit rename**

```powershell
git add app.json package.json
git add app.config.js app.config.ts 2>$null
git commit -m "Rename Expo app to Strider."
```

If only `app.json` and `package.json` changed, add those two. Expected: commit succeeds.

---

