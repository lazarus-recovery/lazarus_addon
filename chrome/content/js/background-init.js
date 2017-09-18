
Lazarus.getPref('debugMode', function(debugMode){

	Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
	Lazarus.logger.log("initalizing background");

  switch(Lazarus.platform.id){
    case "firefox":
      Lazarus.db = new Lazarus.Database("%profile%/lazarus3.sqlite");
    break;
    
    case "chrome":
      chrome.extension.onRequest.addListener(Lazarus.onCallBackground);
      Lazarus.db = new Lazarus.Database("lazarus3.sqlite");
    break;
		
		case "safari":
			gEvent.init("background");
			Lazarus.db = new Lazarus.Database("lazarus3.sqlite");	

			//we cannot add a button or link to the options page,
			//so we'll have to make do with a checkbox.
			//listen for changes to the advancedOptions chekbox
			//and open the options page if the checkbox is checked.
			safari.extension.settings.addEventListener("change", function(evt){
				if (evt.key == "advancedOptions" && evt.newValue){
					//open the options tab
					Lazarus.Background.openOptions();
			
					//and unselect the option
					//totally unable to stop the checkbox from being set :(
					//evt.newValue = false;
					//evt.preventDefault();
					//evt.stopPropagation();
					//so we'll have to update the setting programatically
					//but this won't update the checkbox until next time the extensions dialog is opened
					safari.extension.settings.setItem("advancedOptions", false);
					return false;
				}
			}, true);
		break;
  }
  
	//and finally call the "normal" initalization
	Lazarus.Background.init(); 

});