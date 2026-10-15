# FetchFlow for Dataverse — Visual Query Designer

The Dataverse HTML web resource opens directly in a **clean FetchXML Builder**. The earlier all-in-one Explorer layout is no longer embedded. Instead, the three main actions are available from the top bar: **Execute query**, **View FetchXML**, and **Visualise**. The public/portable FetchFlow Explorer remains separate and unchanged.

## Builder workflow

1. Choose a Dataverse table from the searchable sidebar. FetchFlow loads its fields from metadata in the current environment.
2. **Drag and drop fields** into that table's Selected fields area, or press **+** beside a field. Click **Show fields** on any card to switch the sidebar to that table. Click × to remove a field.
3. Press **+ Linked entity** on a table card to add a relationship. FetchFlow suggests metadata-defined joins where available. You can edit the related table, from/to columns, join type and alias. Add multiple linked entities, including nested links (up to 14).
4. Press **+ Add condition** on any table or linked entity, then set its filter column, operator and value. Choose AND/OR per table.
5. Set preview row count (1–50), distinct, and sort.
6. Press **Execute query** to run the FetchXML with the signed-in user's privileges and inspect up to 50 results. A platform error appears in the results area for troubleshooting.
7. Press **View FetchXML** to inspect/copy/download generated XML. Choose Edit XML for unsupported advanced constructs. The separate source is preserved if it cannot be safely imported into the visual model.
8. Press **Visualise** to display the table relationship, query-flow and field-lineage diagrams for the currently generated or manually edited XML. This structural view does not execute the query.

The builder uses native HTML drag-and-drop on desktop and a click-to-add alternative for touch, keyboard and mobile users. It does not save records or modify views.

## Install in a model-driven app

1. Download the latest [Dataverse ZIP](https://fetchflow.mightora.io/downloads/Mightora-FetchFlow-Dataverse.zip), or the [standalone HTML web resource](https://fetchflow.mightora.io/dataverse/mightora_fetchflow_builder.html).
2. In [Power Apps](https://make.powerapps.com/) > Solutions, open an unmanaged solution and create a **Webpage (HTML)** web resource using `mightora_fetchflow_builder.html`. Save and publish; observe your publisher prefix in the final resource name.
3. Edit the model-driven app → **Pages → New → Web resource**. Select the new resource and enable **Show in navigation**.
4. Set the title to **FetchXML Builder**, save, publish and test with an appropriately permissioned user.
5. When updating an existing installation, replace the HTML contents of the same resource and publish; no navigation rebuild is required.

The downloadable ZIP contains individual web resources, **not** a managed solution ZIP. The optional form launcher and command script remain included for dialog opening. Update their embedded resource name if your solution publisher uses a different prefix.

## Capabilities and limitations

- Dataverse metadata is read from `EntityDefinitions`, including table/column labels and one-to-many/many-to-one relationship suggestions. Those calls stay on the web resource's authenticated Dataverse origin.
- Query execution uses `Xrm.WebApi.online.retrieveMultipleRecords` with raw FetchXML and the signed-in user. Preview is capped at 50 rows; complex queries still consume server resources. The app never performs a Dataverse write.
- You may compose multiple relationships and basic filter conditions visually. Complex aggregates, nested filter groups, custom entity attributes and unsupported FetchXML constructs should be edited in the XML source view. Unsupported import does **not** silently simplify the query.
- Results are rendered as text, not HTML. The result preview isn't persisted in local storage or sent to Mightora. User-triggered XML downloads go to the user's device.
- If metadata access fails, table discovery won't populate; XML source mode and visualisation still work. Live Execute requires a valid Microsoft `Xrm` host and Dataverse connectivity.
- The document, HTML, JS, CSS and logo are self-contained in the web resource. Its content security policy restricts metadata traffic to the Dataverse origin.
- Browser behaviour and user permissions should be tested in a real tenant before wider rollout. Automated tests mock Dataverse and cannot prove tenant compatibility.

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
