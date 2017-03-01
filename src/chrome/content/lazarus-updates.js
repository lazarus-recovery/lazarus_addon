

//dictionary for update scripts
Lazarus.updates = {};

Lazarus.updates["1.0.0"] = function(){
    //updating from  pre-release version, kill any old database 
    Lazarus.killDB();
} 

Lazarus.updates["1.0.1"] = function(){
    Lazarus.initDB();
    //new formId code.
    Lazarus.emptyDB();
    //add new field to database to allow autofill fields
    Lazarus.db.exe('ALTER TABLE forms ADD autofill INT');
} 



Lazarus.updates["2.0beta1"] = function(){
    //using weave's hybrid (RSA & AES) encryption instead of firefox's secret key ring
    //adding full text search and lots of other goodness
    Lazarus.killDB();
}

Lazarus.updates["2.0beta2"] = function(){
	Lazarus.initDB();
	Lazarus.db.exe('ALTER TABLE forms ADD text_length INT');
	Lazarus.db.exe('ALTER TABLE textdata ADD text_length INT');
}


Lazarus.updates["2.0.6"] = function(){
	if (Lazarus.getPref("extensions.lazarus.expireSavedForms") == true &&
			Lazarus.getPref("extensions.lazarus.expireSavedFormsInterval") == 4 &&
			Lazarus.getPref("extensions.lazarus.expireSavedFormsUnit") == 10080){

		setTimeout(function(){
			var features = "chrome,titlebar,toolbar,centerscreen,resizable";		
			window.open("chrome://lazarus/content/update-expires.xul", "LazarusUpdateExpires", features);	
		}, 1000);
	}
	//cleanup unused prefs
	Lazarus.killPref("extensions.lazarus.cleanDatabaseAtStartup");
	
	//prevent the cleanup operation from running for now,
	//it will run next time the browser has loaded
	Lazarus.cleanupSavedForms = function(){}
}

Lazarus.updates["2.1beta6"] = function(){
	//using js encryption (slower, but sick to death of the problems caused by the weave component)
	Lazarus.killDB();
}