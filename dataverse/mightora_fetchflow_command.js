/* Mightora FetchFlow — model-driven command-bar entry point.
 * Command designer: JavaScript action -> MightoraFetchFlow.openBuilder
 * Optional parameter: PrimaryControl. No deprecated Xrm.Page dependency.
 */
var MightoraFetchFlow = (function () {
  'use strict';
  function openBuilder(primaryControl) {
    var entityName = '';
    try {
      if (primaryControl && primaryControl.data && primaryControl.data.entity) {
        entityName = primaryControl.data.entity.getEntityName() || '';
      }
    } catch (error) { entityName = ''; }
    var data = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(entityName)
      ? JSON.stringify({entityName:entityName}) : '';
    return Xrm.Navigation.navigateTo(
      {pageType:'webresource',webresourceName:'mightora_fetchflow_builder.html',data:data},
      {target:2,position:1,width:{value:90,unit:'%'},height:{value:90,unit:'%'},title:'Mightora FetchFlow'}
    );
  }
  return {openBuilder:openBuilder};
}());
