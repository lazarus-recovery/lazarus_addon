

Lazarus.DisableOnSite = {

  domain: '',

  init: function(){
  
		Lazarus.getPref('debugMode', function(debugMode){

			Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
			Lazarus.logger.log("initalizing DisableOnSite page");
			
      var params = Lazarus.Utils.decodeQuery(document.location.search)
      
      if (params.domain){
        Lazarus.DisableOnSite.domain = params.domain.toLowerCase();
      }
      
      Lazarus.locale.setStrings({
        'disableOnSite.site': Lazarus.DisableOnSite.domain
      });
      Lazarus.locale.localiseDOM(document);
      
      if (!Lazarus.DisableOnSite.domain){
        Lazarus.msg('error.domain.required', 'error');
        $('#btn-disable-on-site').hide();
      }
      
			
			$('#disable-on-site-form').submit(function(){
				
        var removeForms = $('#remove-existing-forms')[0].checked;
        
        //should we remove existing forms?
        Lazarus.callBackground("Lazarus.Background.disableByDomain", [Lazarus.DisableOnSite.domain, function(){
        
          if (removeForms){
            Lazarus.callBackground("Lazarus.Background.removeSavedFormsByDomain", [Lazarus.DisableOnSite.domain, function(){
              Lazarus.dialog.sendResponse("formsRemoved");
            }]);
          }
          else {
            //domain disabled
            Lazarus.dialog.sendResponse("domainDisabled");
          }
        }]);
				
				//don't let the form submit
				return false;
			});
			
			//if the user hits cancel close the dialog
			$('#cancel').click(function(){
				Lazarus.dialog.sendResponse(false);
			});
			
			//or if they hit escape
			$(document).keydown(function(evt){
				var KEY_ESCAPE = 27;
				if (evt.keyCode == KEY_ESCAPE){
					Lazarus.dialog.sendResponse(false);
				}
			})
			
			//and focus on the password box to start
			$('#btn-disable-on-site').focus();
			
		});
  }
}


Lazarus.environment = "content";

if (Lazarus.platform.id == "safari"){
  gEvent.init("content");
}

$(window).load(function(){
	Lazarus.DisableOnSite.init();
});
