# FetchFlow for Dataverse — Live Builder + Visual Explorer

FetchFlow provides **two complementary workspaces**:

1. **Live FetchXML Builder (Dataverse web resource):** Discover environment tables and readable attributes; pick columns; select a metadata-defined relationship; build or paste FetchXML; and execute a **read-only query** using the current signed-in model-driven app user. It displays up to 50 returned records, without saving the results.
2. **FetchXML Explorer (web, offline and Dataverse):** Paste existing FetchXML and troubleshoot the query structure through source/relationship diagrams, pipeline flows, field lineage, explanations and exports. The public GitHub Pages app and offline edition **never connect** to Dataverse.

The Dataverse HTML web resource contains both workspaces, with the connected Builder prominently shown first. The Explorer is also available below the Builder.

## Install the full-page web resource in a model-driven app

1. Download https://fetchflow.mightora.io/downloads/Mightora-FetchFlow-Dataverse.zip and extract it; or download the direct `mightora_fetchflow_builder.html` web resource.
2. Go to https://make.powerapps.com/ > **Solutions** and open your unmanaged solution. Select **New → More → Web resource**, type **Webpage (HTML)**, and upload `mightora_fetchflow_builder.html`.
3. Give it a friendly display name such as **FetchFlow — Live FetchXML Builder and Explorer**. Save, then **Publish**. Check the complete web resource name, including your publisher's customisation prefix.
4. Edit your model-driven app → **Pages → New → Web resource**, select this web resource, and enable **Show in navigation**.
5. Name the page **FetchXML Builder** and place it in a relevant group, such as **Developer Tools**. Save and publish the model-driven app.
6. Run the app as a user who has the appropriate Dataverse privileges. The Live Builder will discover metadata in **that environment**. You can then select a table/columns and execute a query. The read-only query executes as that user.

**The download ZIP is not a Dataverse solution ZIP.** Add its HTML file as a web resource to an unmanaged solution, and export your solution normally for managed ALM.

## Live Builder capabilities

- **Metadata discovery:** reads Dataverse `EntityDefinitions` and table `Attributes` on the same Dataverse origin using a browser session that is already authenticated by Microsoft. The table picker searches display and logical names.
- **Column selection:** readable columns are selected in a multi-select list and populate the visual composer. Simple starter queries select explicit columns rather than `all-attributes`.
- **Relationship suggestions:** reads one-to-many and many-to-one relationship metadata where permitted, then populates the linked table's `from` and `to` keys. Check join semantics and types before running.
- **Visual composition:** shares the supported FetchXML composer with the public app: root table, selected columns, basic AND/OR filters, one linked entity, sorting, distinct and top. Imported advanced XML continues to be editable in the full XML editor.
- **Live query execution:** executes either the visual builder's generated FetchXML or the raw XML editor's query with `Xrm.WebApi.online.retrieveMultipleRecords`, using **raw, unencoded FetchXML**. Live results display in a scrollable table. The execution copy is bounded to the first 50 records; if a `top` attribute exists it is capped at 50 for the preview.
- **Results and errors:** displays query result values as **text**, not HTML, including formatted labels when available. An error from the platform is shown in the tool for troubleshooting. Results are kept in the current browser page and can be cleared.
- **Read saved queries:** choose **Find saved views** to load the FetchXML of accessible system or personal Dataverse views into the editor (up to 100 of each kind). This is a read-only operation; views are not changed.\n- **Visual Explorer:** all existing diagrams, explanations and editable exports remain available alongside the Builder.

## Security and privacy

- No separate sign-in, connection string, app secret, OAuth token or API key is collected or persisted. It relies on the Microsoft Dataverse-hosted page and signed-in model-driven app session.
- All metadata requests are **GET** requests to the web resource's **same origin**, using the Dataverse Web API. The Dataverse edition's CSP allows `connect-src 'self'` only; other external endpoints are blocked.
- Query execution uses the Microsoft model-driven app `Xrm.WebApi.online.retrieveMultipleRecords` API, which is read-only and enforces the current user's Dataverse table/row permissions. There are no create, update, delete or batch operations.
- **Real Dataverse data may appear in the results preview.** Use the tool only in environments/users permitted to view that data; avoid exposing the tool to unauthorised users. Preview rows and query errors can contain sensitive information.
- FetchXML is not automatically stored in records or sent to the Mightora website. Result previews are not written to localStorage, IndexedDB or cookies. Export operations initiated by users save to their chosen device.
- **This edition is not offline.** It requires the Dataverse app and API to be reachable. The independently downloadable FetchFlow Explorer is still available offline with `connect-src 'none'`.
- Only the first 50 rows are returned for preview, but complex joins/aggregates can still be expensive for Dataverse to execute. Do not use this as a load-testing platform.
- The URL must be hosted in the **same Dataverse origin** as the authenticated model-driven app. If the app is not in the expected host frame or an unsupported cross-origin frame is used, live execution stays disabled. Supported host policies and model-driven clients vary; perform tenant-level validation.

## Optional dialog and form launchers

The ZIP also contains `mightora_fetchflow_launcher.html` and `mightora_fetchflow_command.js`, retaining the original optional form/dialog experience via `MightoraFetchFlow.openBuilder` and `Xrm.Navigation.navigateTo`. Adjust the referenced HTML resource name when your publisher prefix differs. Neither launcher is necessary for full-page navigation.

## Troubleshooting

- **Dataverse not connected:** open the web resource **inside** a signed-in model-driven app; do not preview it as a local file or GitHub Pages page.
- **Metadata discovery fails:** check the environment host/origin and the user's ability to access metadata. You can still enter logical names manually and execute a query if the Xrm context is present.
- **Table/column error on query execution:** check the selected column names, relationship join directions, user security roles and FetchXML filter operators.
- **Complex FetchXML cannot be imported visually:** use the XML editor and select **XML editor** in the Live Builder's query-source selector to execute without simplifying it.
- **No rows returned:** check filters, joins and record visibility. Zero rows is not necessarily an error.

## References

- https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-metadata-web-api
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-webapi/retrievemultiplerecords
- https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/web-resources
- https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/create-remove-pages

Source: https://github.com/mightora/fetchflow.mightora.io · MIT licence.
