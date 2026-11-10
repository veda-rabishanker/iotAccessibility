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

