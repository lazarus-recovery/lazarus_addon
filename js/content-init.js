
//internal extension pages are also initialized by the content scripts
//but they shouldn't be, rather they should initialize themselves 
if (document.URL.match(/^http(s)?:/i)){
	
	if (Lazarus.platform.id == "safari"){
		gEvent.init("content");
	}
	
	Lazarus.getPref('debugMode', function(debugMode){
		//replace with the correct log level
		Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);

		Lazarus.logger.log("initializing content");
		Lazarus.Content.init();
		//NOTE: document is NOT fully loaded when this script runs
		Lazarus.Content.initDoc(document);
		
	});
}
