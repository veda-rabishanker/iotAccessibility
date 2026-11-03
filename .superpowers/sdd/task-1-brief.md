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

