# Mightora FetchFlow — full-page web resource for model-driven apps

FetchFlow is a **full-page HTML web resource** that can appear as a normal page in the model-driven app navigation (site map), alongside tables and dashboards. The page uses the same open-source FetchXML builder, diagram, explanation, and export engine as the GitHub Pages and offline editions. It is not a canvas-based Power Apps custom page.

## Recommended: install FetchFlow as a full app page

1. Download **Mightora-FetchFlow-Dataverse.zip** from https://fetchflow.mightora.io/downloads/Mightora-FetchFlow-Dataverse.zip and extract it.
2. Open **make.powerapps.com** > **Solutions**, then select an **unmanaged solution** with the intended solution publisher.
3. Create a new **Web resource** of type **Webpage (HTML)**. Upload `mightora_fetchflow_builder.html`. Give it a friendly display name such as **Mightora FetchFlow — FetchXML Builder**. Save and **Publish**.
4. Note the **full web resource name shown after saving**. Dataverse automatically applies the solution publisher's customization prefix. The web resource can have a different name if your publisher prefix is not `mightora`.
5. Open your **model-driven app** in the modern app designer. Under **Pages**, select **New** (or **Add page**) → **Web resource**, select the uploaded FetchFlow HTML web resource and add it.
6. Set its navigation title to **FetchXML Builder**, keep **Show in navigation** selected, and place it in an appropriate navigation group (for example, **Developer Tools**).
7. **Save and publish** the app. Open it and select **FetchXML Builder** from the left navigation. FetchFlow runs inside the authenticated app shell with its own responsive, full-width workspace.

The URL under your Dataverse environment will correspond to `/WebResources/<full-web-resource-name>`. Prefer selecting it through the app designer rather than typing an unversioned URL.

**Important:** The downloaded ZIP contains **individual web-resource files**, not an importable Dataverse solution. You must add the resource to a solution; after validation you can use normal managed-solution export/import for ALM.

## What the page includes

- Visual query composer: primary table, selected/all columns, AND/OR conditions, one linked table, optional ordering, top and distinct.
- Live XML preview, copy/download, and apply to the existing XML editor.
- All existing FetchFlow explanations, source/relationship diagrams, pipeline diagram, field lineage, examples, editable DOCX/PPTX, and other exports.
- A compact Mightora-branded app header and sticky section navigation. Public-site marketing, author card, external trust badges and large footer are **not repeated** inside the model-driven shell.
- Local-only query processing: no connections to an external Mightora service, live Dataverse records or table metadata.

The full-page edition deliberately starts on a simple query that matches the visual composer. If invoked with a supported `data` parameter containing `{"entityName":"account"}` or a `typename` parameter, it may start on that table. Opening it via the app navigation normally starts on `account`.

## Alternative: launch a dialog from a record form

The same `mightora_fetchflow_builder.html` can also be used as a dialog. The package retains:
- `mightora_fetchflow_launcher.html` — compact form-embedded launcher button.
- `mightora_fetchflow_command.js` — JavaScript action `MightoraFetchFlow.openBuilder` for a command-bar button.

If you use these optional launchers, create those web resources in the same solution. **Their code assumes the complete builder web resource name is `mightora_fetchflow_builder.html`.** If the publisher prefix or resource name differs, update that string in each launcher first. Pass `PrimaryControl` to the command action when appropriate. The popup uses `Xrm.Navigation.navigateTo({pageType:'webresource',...})`.

You do **not** need the launcher or command script to add FetchFlow to the app's left navigation.

## Capabilities and limitations

- The tool does not call the Dataverse Web API, discover environment tables or relationships, run FetchXML or write queries to Dataverse. Logical names and joins must be verified by the user.
- The visual composer supports a subset of FetchXML. Advanced constructs (such as aggregate queries, complex nested filters and multiple links) remain available through the original XML editor. Unsupported queries are rejected on import rather than silently modified.
- The HTML file is a fully self-contained web resource with embedded JavaScript, styles and official Mightora logo; no remote CDN, telemetry, external origin or local server is required by FetchFlow.
- The application host itself makes Microsoft platform network requests outside the FetchFlow web resource. Use F12 → Developer Tools → Network → Preserve log → reload to inspect requests; the resource timing summary alone is not a security audit.
- Test the actual tenant before rolling out broadly, including responsive layouts, exports, iframe security policy, and the user's privileges.
- If packaging a managed solution, test the intended publisher customization prefix and solution-layering strategy.

## References

- [Microsoft — Work with pages in model-driven apps](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/create-remove-pages)
- [Microsoft — Create or edit web resources](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/create-edit-web-resources)
- [Microsoft — HTML web resources](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/webpage-html-web-resources)
- [Microsoft — Navigation API](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-navigation/navigateto)

Source: https://github.com/mightora/fetchflow.mightora.io · MIT licensed.
