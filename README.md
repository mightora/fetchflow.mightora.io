# FetchFlow · Mightora

[![Build and tests](https://github.com/mightora/fetchflow.mightora.io/actions/workflows/ci.yml/badge.svg)](https://github.com/mightora/fetchflow.mightora.io/actions/workflows/ci.yml)
[![CodeQL](https://github.com/mightora/fetchflow.mightora.io/actions/workflows/codeql.yml/badge.svg)](https://github.com/mightora/fetchflow.mightora.io/actions/workflows/codeql.yml)
[![Deploy Pages](https://github.com/mightora/fetchflow.mightora.io/actions/workflows/pages.yml/badge.svg)](https://github.com/mightora/fetchflow.mightora.io/actions/workflows/pages.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)

**A free, privacy-first, static FetchXML builder and visualiser for Microsoft Power Platform and Dataverse.**

Paste FetchXML to produce three diagrams, a plain-English explanation, and documentation that can be edited in Microsoft Word and PowerPoint. There are no servers or user accounts. The browser does all analysis and file generation.

## What you get

- **Visual FetchXML builder:** design a basic FetchXML query from table/column names, filter conditions, a linked table, sorting, distinct and top rows; preview and apply the query to the existing three-diagram visualiser. For complex queries the raw XML editor remains the source of truth.
- **Model-driven app full-page web resource:** download the self-contained HTML builder, add it as a Web resource page in your app, and show FetchFlow in the normal left-hand navigation. Optional dialog and form launchers remain available. See [`dataverse/README.md`](dataverse/README.md) for installation. No live Dataverse metadata access or query execution is implied.

- **Source and relationship diagram:** root Dataverse table, related tables, alias names and matching `from`/`to` columns.
- **Query-flow chart:** human-friendly interpretation of join stages, nested filter groups, sort order, aggregation and result shaping. Not an actual Dataverse execution plan.
- **Column-lineage diagram:** selected output field names, aliases, source columns and aggregate transformations.
- **Six anonymised example queries:** basic contacts, primary contacts, case management, revenue aggregates, unmatched outer joins and multi-hop relationships.
- **Editable PowerPoint:** native PowerPoint shapes, connectors and text boxes; diagrams and labels can be changed in PowerPoint.
- **Editable Word:** native Word tables and paragraphs for source mapping, flow and field lineage. They are editable but not free-floating shape diagrams.
- **Other exports:** SVG, PNG, Mermaid, JSON and the original XML.
- **Offline package:** one HTML file containing scripts, styles, icons and artwork; works without a server, account or connection. ZIP also contains README and MIT licence.
- **Responsive UX**, keyboard focus indicators and clear error feedback.

## Online and offline privacy

FetchXML is parsed using the browser's DOMParser. **The application makes no request to Dataverse** and never asks for credentials or a connection string. No application analytics are shipped.

The **online** edition requests brand UI CSS, components, YAML parsing support and branding imagery from GitHub / jsDelivr. Those assets are not used to process pasted FetchXML.

The **offline** edition uses a restrictive Content Security Policy (`connect-src 'none'`), a hashed script/style, embedded images and no network dependencies. On a production build the official Mightora logo and the author images are pulled in from their official sources then base64 embedded. The source package may produce labelled local placeholders if those images aren't available; production CI refuses to publish without the official Mightora logo.

**Verify network behaviour:** press F12 → Developer Tools → Network → check Preserve log → reload and inspect the requests. The visible resource-timing summary is a convenience only, not a replacement for DevTools or a security assessment. Browser extension or OS traffic is outside the page's scope.

## Getting started

### Development

```bash
npm install --no-fund
npm test
npm run build
node scripts/verify.cjs
```

`dist/index.html` is the online static site, while `dist/offline/index.html` and `dist/downloads/Mightora-FetchFlow-Offline.zip` are the portable releases. `dist/dataverse/` and `dist/downloads/Mightora-FetchFlow-Dataverse.zip` contain the model-driven app web-resource edition.

For a **production build**, provide `assets/mightora-logo.png` (download from the official Mightora branding URL below) and set `REQUIRE_BRAND_ASSETS=1`.

### GitHub Pages

1. Create the public **`mightora/fetchflow.mightora.io`** repository and commit the contents of this project to the **main** branch.
2. In GitHub **Settings → Pages**, choose **GitHub Actions** as the deployment source.
3. Set up `fetchflow.mightora.io` as a GitHub Pages custom domain, and configure DNS at your hosting provider. This repository includes the `CNAME` file; DNS still needs configuring.
4. The `pages.yml` workflow downloads the exact Mightora logo, builds, validates and deploys the page. Its branded, embedded offline package is produced at the same time.
5. `ci.yml`, `codeql.yml` and Dependabot provide build, browser, security and dependency checks. Their badges are verifiable evidence links, not assurances of security.

Brand source: `https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png`.

## Structure

- `src/` — shared parser, visual query builder, diagrams, exports, browser application, styling and markup for all editions.
- `examples/examples.json` — easy-to-contribute worked FetchXML examples.
- `vendor/` — checked-in browser distributions of PptxGenJS and JSZip so the runtime requires no additional library CDN.
- `scripts/build.cjs` — deterministic single-file builds and ZIP package.
- `scripts/verify.cjs` — checks CSP, runtime dependencies and ZIP parity.
- `tests/` — unit and Playwright E2E checks, including native Office export checks.
- `.github/` — CI, CodeQL, deployment and Dependabot workflows.

### Adding examples

Open a pull request to `examples/examples.json`. Provide `id`, `name`, `description` and `xml`. Use fictitious / anonymised names. Unit tests ensure all examples continue to parse.

## Dataverse integration

Install the downloadable HTML web resource into a Dataverse solution, then use the model-driven app designer **Add page → Web resource** and enable **Show in navigation**. The page opens within the app shell rather than launching a separate marketing site. Optional command-bar and form-embedded HTML launchers use `Xrm.Navigation.navigateTo` for dialog access. The ZIP contains **web-resource source files**, not a ready-to-import managed solution. For installation, naming, privacy and capabilities, read [the Dataverse setup guide](dataverse/README.md).

## Limitations

- This tool analyses the **XML structure**, not actual Dataverse records, table metadata, permissions, performance, query plans, row counts or query execution. Validate important decisions in your target Dataverse environment.
- For unusual link types, such as `not any`, `all`, `in`, `exists` or cross-apply, it warns that semantics are more specialised than an ordinary join.
- Linked-table filters can apply during joins, and `entityname` filters may apply after outer joins; the conceptual flowchart is **not an optimiser plan**.
- If the input query has no explicitly selected root attributes, a wildcard is represented; actual query projection depends on FetchXML semantics.
- Diagram labels may be shortened onscreen to prevent overlap. Output mapping and editable office exports preserve the original model data.
- `XML` is size-limited to 250 KB with caps of 80 entities and 18 levels to avoid accidental browser overload.
- GitHub workflow status is not verifiable until the public repository is created and the workflows have run.

Microsoft documentation: [FetchXML reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/fetchxml/reference/), [Join tables](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/fetchxml/join-tables), [Filter rows](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/fetchxml/filter-rows).

## Licence

MIT, see [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).