# Contributing Guide

## Primary Branch Policy

This repository is standardized on **`main`** as the primary branch.

- Default integration target: `main`
- Production branch (GitHub + Netlify): `main`
- `master` is retained only as optional temporary backup during migration

## Branch Workflow

1. Update local `main`:
   - `git checkout main`
   - `git pull origin main`
2. Create a feature branch from `main`:
   - `git checkout -b feature/<short-description>`
3. Commit and push your branch.
4. Open a Pull Request **into `main`**.
5. After review, merge PR to `main`.

## Repository Hygiene

- Do not commit secrets/tokens in code or docs.
- Keep PRs focused and small where possible.
- Run local checks/tests before opening PRs.

## Migration Note

If your local clone still points to `master`, switch with:

```bash
git checkout main
git branch --set-upstream-to=origin/main main
git fetch origin --prune
```
