### Task 4: Verify Metro bundles

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: project from Tasks 1–3
- Produces: confirmation that Expo starts without bundle errors

- [ ] **Step 1: Start Expo briefly**

```powershell
npx expo start
```

Wait until the Metro bundler reports it is ready (DevTools URL / QR code). Do not leave it running indefinitely.

- [ ] **Step 2: Confirm no startup errors**

Expected in the terminal: Expo DevTools started; no red-box / fatal config errors about missing entry or invalid `app.json`.

- [ ] **Step 3: Stop Metro**

Press `Ctrl+C` in that terminal (or end the process) so the shell is not left running.

- [ ] **Step 4: Final status check**

```powershell
git status
```

Expected: clean working tree (or only local Expo cache files that are gitignored).

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `create-expo-app@latest` TypeScript + Expo Router | Task 1 (default template) |
| Temp folder move; don’t overwrite `.git` | Task 1 Step 2 |
| Name Strider / slug `strider` / scheme `strider` | Task 2 |
| No custom team bundle ID | Task 2 (explicit non-change) |
| Leave template routes unchanged | Task 1 (no route edits) |
| No extra product packages | Global Constraints + Task 1 |
| `.gitignore` from template | Task 1 |
| Short README how to run | Task 3 |
| Brief `npx expo start` then stop | Task 4 |
| Initial git commits for scaffold | Tasks 1–3 commits |
| Keep `docs/superpowers` | Task 1 Step 2 refuse-overwrite |
