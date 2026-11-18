# LOVECRAFT template library

The catalogue contains declarative template definitions, not executable third-party code. Each category has one folder per template, with `template.json` containing its version, fields, artwork, component composition, and renderer ID. The shared footer belongs to the renderer, outside customization data.

## Built-in library

`npx tsx scripts/export-templates.ts` regenerates `catalog.json`, the per-template manifests and the component manifests from the maintained TypeScript definitions. It validates slugs, component references and the existence of preview artwork. `npx tsx scripts/refresh-library.ts` applies the links-page schema upgrade without altering old site content.

## Publishing from GitHub

Commit the `templates/` directory to your repository. Set its owner, repository and branch in the owner's system settings. For private repositories, supply `GITHUB_TOKEN` on the server with read-only Contents access. The importer reads `templates/catalog.json` via the GitHub Contents API. It rejects unsupported renderer IDs, component variants, incomplete input schemas and malformed data. No JS, arbitrary HTML or remote React components are executed.

To add a template, add its manifest to the category folder and its data to the `templates` array in `catalog.json`. Keep the slug stable and increment the semantic version for changes. Use **مزامنة GitHub** in `/admin`, preview the imported draft as owner, then publish. A previously imported version is never overwritten. Published tenant sites keep their stored version. Repository credentials are not included in the browser bundle.

## Verification

With the managed production preview running, `npx tsx scripts/check-template-readiness.ts` checks every published template's live route, local manifest, version, selection URL and exact global footer target. `node scripts/browser-library-check.mjs` exercises the library and representative template interactions in installed browser engines. Set `CHECK_BASE_URL` to the local preview address if needed. Preview data is illustrative; no Telegram account or user website is seeded during library initialization.

The web studio creates its own HttpOnly session. It cannot act as a Telegram user or earn referral credits. Live Telegram delivery needs a configured bot token and either the Python bot or the secured webhook (choose one). Catbox and private GitHub connectivity require their own deployment checks; a passing preview test does not verify those external services.
