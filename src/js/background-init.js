
Lazarus.getPref('debugMode', function(debugMode){

	Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
	Lazarus.logger.log("initializing background");

	Lazarus.adapter = new Lazarus.DatabaseAdapter();
  
	//and finally call the "normal" initialization
	Lazarus.Background.init(); 

});