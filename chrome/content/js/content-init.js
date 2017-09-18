
//internal extension pages are also initalised by the content scripts
//but they sholdn't be, rather they should initalise themselves 
if (document.URL.match(/^http(s)?:/i)){
	
	if (Lazarus.platform.id == "safari"){
		gEvent.init("content");
	}
	
	Lazarus.getPref('debugMode', function(debugMode){
		//replace with the correct log level
		Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);

		Lazarus.logger.log("initalizing content");
		Lazarus.Content.init();
		//NOTE: document is NOT fully loaded when this script runs
		Lazarus.Content.initDoc(document);
		
	});
}
