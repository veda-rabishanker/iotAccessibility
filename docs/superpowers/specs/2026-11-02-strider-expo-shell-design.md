# Strider — ultra-thin Expo shell

Date: 2026-11-02  
Status: approved for implementation planning

## Goal

Create the smallest runnable Expo app in this repo so we have a place to build Strider later. Add structure and libraries only when a later task needs them.

## Product context (out of scope for this pass)

Strider will eventually be an accessibility app for blind and low-vision walkers (collar camera, obstacle audio/haptics, community map). That product work is **not** part of this shell.

## In scope

1. Scaffold with `npx create-expo-app@latest` using the TypeScript + Expo Router template.
2. Because this directory already has a `.git` folder, scaffold into a temp folder and move files in without overwriting `.git`.
3. Rename the app in config to **Strider**: display name `Strider`, slug `strider`, URL scheme `strider`. Keep the template’s default bundle identifier / package name unless the template already requires setting one — do not invent a custom team ID in this pass.
4. Leave the template’s default routes and screens unchanged. Do not add auth, tabs, session, map, or other product routes.
5. Do not install NativeWind, Firebase, Zustand, expo-dev-client, maps, biometrics, speech, haptics, or other product packages.
6. Keep or add a normal Expo `.gitignore` so `node_modules`, `.expo`, env files, etc. are ignored.
7. Keep a short README that says what this repo is right now and how to run it with Expo Go (`npx expo start`).
8. Verify the project starts (brief `npx expo start`), then stop Metro.
9. Create an initial git commit for the scaffold (repo has no commits yet).

## Out of scope

- Custom folder layout (`features/`, `components/`, etc.)
- Accessibility helpers, theme system, lint/prettier beyond what the template ships
- Firebase, env files, Firestore/Storage rules
- Device/camera or analysis abstractions
- EAS, `eas.json`, native builds, logging into any external service

## Success criteria

- `npm install` works (from the scaffold).
- `npx expo start` bundles without errors.
- Opening the template home screen in Expo Go or a simulator is possible.
- Git has one initial commit containing the shell (and this spec).

## Follow-ups (explicitly later)

When needed: product routes, NativeWind, Firebase JS SDK, a11y helpers, camera/analysis interfaces, community map, etc. — each as its own task, not assumed here.
