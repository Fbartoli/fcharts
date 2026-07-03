# Releasing fcharts-js

Releases are tag-triggered and CI-published. The publish re-runs the full quality gauntlet
(`prepublishOnly` = typecheck, lint, 207 unit + 36 browser tests, build, size budget), so a tag
can never ship an unverified tarball.

## One-time setup (repo owner)

Configure npm **Trusted Publishing** so CI can publish with OIDC — no token secret:

1. npmjs.com → package `fcharts-js` → **Settings → Trusted Publisher**
2. Select **GitHub Actions**; owner `Fbartoli`, repository `fcharts`, workflow `release.yml`.

Until this is configured, the release workflow fails at the publish step; the fallback is a
manual `pnpm publish` from a terminal (interactive npm 2FA).

Because the repo is public, npm attaches a **provenance attestation** automatically on every
CI publish.

## Release flow

```sh
# on a feature branch (main is push-protected):
#   1. bump the version + stamp the changelog
#   2. PR → CI green → merge
# then, from the updated main:
git tag -a vX.Y.Z -m "fcharts-js X.Y.Z — <one-line summary>"
git push origin vX.Y.Z
```

The `release` workflow asserts the tag matches `package.json` (a mismatched tag fails fast),
runs the gauntlet, and publishes. Afterwards:

3. Create the GitHub Release for the tag (`gh release create vX.Y.Z --verify-tag …`), pasting
   the CHANGELOG section as notes.
4. On the release page, tick **“Publish this Action to the GitHub Marketplace”** — the repo
   root `action.yml` (the `fcharts-audit` action) is listed from the released ref. Any tag from
   0.2.0's successor onward contains it.

## Checklist per release

- [ ] `package.json` version bumped; `CHANGELOG.md` `[Unreleased]` → `[X.Y.Z] — date`
- [ ] README tarball filename reference (`fcharts-js-X.Y.Z.tgz`) updated
- [ ] PR merged green; tag pushed from updated main
- [ ] `release` workflow green (npm shows the new version + provenance)
- [ ] GitHub Release created; Marketplace box ticked
- [ ] Landing site redeployed if it changed (`landing/DEPLOY.md`)
