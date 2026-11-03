# Strider Ultra-Thin Expo Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a minimal runnable Expo (TypeScript + Expo Router) app named Strider in this repo, with no product routes or extra libraries.

**Architecture:** Use `create-expo-app`’s default template into a temp folder, move its files into the repo root without touching `.git` or the existing `docs/` tree, then rename the app in config and tighten the README. Leave template routes as-is.

**Tech Stack:** Expo SDK (latest stable via `create-expo-app@latest`), TypeScript, Expo Router (template default), npm.

## Global Constraints

- Do not install NativeWind, Firebase, Zustand, expo-dev-client, maps, biometrics, speech, haptics, or other product packages.
- Do not add custom product routes, `features/`, or accessibility helper libraries.
- Do not create `eas.json`, run EAS builds, or log in to any external service.
- Do not overwrite `.git` or delete `docs/superpowers/`.
- Display name `Strider`, slug `strider`, URL scheme `strider`; do not invent a custom team bundle ID in this pass.
- Windows PowerShell is the shell; prefer PowerShell-safe commands.

---

## File structure (after scaffold)

| Path | Responsibility |
|------|----------------|
| `app/` | Template Expo Router screens (unchanged) |
| `app.json` or `app.config.js` | Expo config — rename to Strider |
| `package.json` | Dependencies and scripts from template; name `strider` |
| `README.md` | How to run this shell |
| `.gitignore` | Expo ignores from template |
| `docs/superpowers/` | Existing spec/plan docs (keep) |

---

### Task 1: Scaffold Expo app into repo root

**Files:**
- Create: all files from `create-expo-app` default template under repo root
- Preserve: `.git/`, `docs/superpowers/`

**Interfaces:**
- Consumes: none
- Produces: runnable Expo project at repo root with template `app/` routes

- [ ] **Step 1: Create the app in a temp directory**

Run from `C:\Users\royob\Desktop\iotAccessibility`:

```powershell
npx create-expo-app@latest .tmp-strider -y
```

Expected: a new folder `.tmp-strider` with `package.json`, `app/`, and `node_modules` installed. Exit code 0.

- [ ] **Step 2: Move template files into the repo root**

```powershell
Get-ChildItem -Force .\.tmp-strider | ForEach-Object {
  $dest = Join-Path . $_.Name
  if (Test-Path $dest) {
    Write-Error "Refusing to overwrite existing path: $dest"
    exit 1
  }
  Move-Item -LiteralPath $_.FullName -Destination $dest
}
Remove-Item -LiteralPath .\.tmp-strider -Recurse -Force
```

Expected: template files sit next to `docs/`; `.tmp-strider` is gone; `.git` untouched.

- [ ] **Step 3: Confirm package.json exists and lists expo**

```powershell
Get-Content .\package.json | Select-String -Pattern '"expo"|"name"'
```

Expected: lines showing a `"name"` field and an `"expo"` dependency.

- [ ] **Step 4: Commit the scaffold**

```powershell
git add -A
git status
git commit -m "Scaffold Expo TypeScript app for Strider shell."
```

Expected: commit succeeds; working tree clean except for intentional untracked files if any.

---

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

### Task 3: README for the shell

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: scripts from template `package.json` (at least `npx expo start`)
- Produces: short README describing current shell scope and how to run

- [ ] **Step 1: Replace README.md with shell-focused content**

```markdown
# Strider

Ultra-thin Expo (React Native) shell for the Strider accessibility app. This pass is scaffolding only — template routes, no product features yet.

## Prerequisites

- Node.js 22+ (LTS is fine)
- Phone with [Expo Go](https://expo.dev/go), or iOS Simulator / Android Emulator

## Run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i` / `a` for simulators.

## Not in this shell yet

Product routes, NativeWind, Firebase, device/camera layer, and analysis — added when needed.
```

- [ ] **Step 2: Commit README**

```powershell
git add README.md
git commit -m "Document how to run the Strider Expo shell."
```

Expected: commit succeeds.

---

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
