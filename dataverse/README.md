# Install FetchFlow in a model-driven Power App

**Edition:** HTML web resources for Dataverse, built from the same FetchFlow sources as the website and offline package. No external JavaScript, CSS, API keys or hosting is required to compose queries. This edition does **not** read live Dataverse metadata, execute queries or access records.

## Files
- `mightora_fetchflow_builder.html`: the full single-file visual builder + existing FetchFlow visualisation/export functionality.
- `mightora_fetchflow_launcher.html`: compact form-embedded button which opens the builder in a dialog.
- `mightora_fetchflow_command.js`: optional modern command-bar action (preferred form experience).

## Setup in a Dataverse solution
1. Open Power Apps > Solutions. Select or create an **unmanaged solution** with an appropriate publisher. Add the files as **new Web Resources**. Use *exactly* the resource names above (or adjust the names in both launcher and command script).
2. Publish the web resources. For managed distribution, export the solution as managed through your normal ALM process. The download ZIP is **not** an importable Dataverse solution package.
3. **Recommended:** In the model-driven app designer, select the table's **main form** command bar, create a JavaScript command named *Build FetchXML*, add the `mightora_fetchflow_command.js` library, and call `MightoraFetchFlow.openBuilder`. Pass **PrimaryControl** as its command parameter when available, so FetchFlow can preselect the table. Publish.
4. **Alternative inline form launcher:** On the table's main form, add an HTML web resource control pointing to `mightora_fetchflow_launcher.html`. Give it a small height and enable context parameters (including the table logical name) where form designer options permit; save and publish the form.
5. Open a record. Press *Build FetchXML* or *Open FetchXML Builder*. The builder opens as a 90%-wide native model-driven app dialog. It does not automatically save queries into a table field.

## Notes
- The builder does not use `Xrm.Page` or rely on direct `Xrm` availability inside its own HTML resource. The optional compact form launcher calls the documented `parent.Xrm.Navigation.navigateTo` interface from a form container. This may not work if an iframe is embedded in another, unsupported host; prefer the command-bar action.
- The current builder handles a primary table, explicit or all columns, distinct, top, basic AND/OR conditions, one root-level link-entity, and sorting. Complex nested links, advanced filters, aggregates and group-by should remain in the raw XML editor. Existing FetchFlow diagrams and exports remain available.
- Condition values are XML-escaped, logical-name inputs are validated, and imported unsupported queries are rejected to avoid data loss. The query is **not** checked against table metadata or security roles.
- No query execution or Dataverse data requests are made by FetchFlow. Running a Dataverse query in future requires explicit, role-governed integration.
- This HTML web-resource edition is self-contained, except for the normal network requests made by the Microsoft model-driven app host. Its CSP prevents the web resource from initiating network connections.
- No account, telemetry, external CDN or remotely hosted iframe is required by FetchFlow. Web-resource XML remains in the browser unless a user deliberately copies/exports it.
- If a tenant enforces a stricter host CSP or blocks embedded HTML scripts, prefer the supported command-bar action and review the deployment with the tenant administrator.

## Privacy verification
From the browser, press F12 > Developer Tools > Network > Preserve log > reload. Requests from the Microsoft application platform may still occur, but FetchFlow's Dataverse builder performs no background query calls. Inspect the Network panel for validation.

Official Microsoft reference: https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-navigation/navigateto

Source: https://github.com/mightora/fetchflow.mightora.io
Licence: MIT.
