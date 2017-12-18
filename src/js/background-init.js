
Lazarus.getPref('debugMode', function(debugMode){

	Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
	Lazarus.logger.log("initalizing background");

	Lazarus.adapter = new Lazarus.DatabaseAdapter();
  
	//and finally call the "normal" initalization
	Lazarus.Background.init(); 

});