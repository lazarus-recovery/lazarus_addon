
/**
* common functions used by our code
*/

//declare namespace
this.Lazarus = this.Lazarus || {};

Lazarus.$ = function(id, doc){
	doc = doc || document;
	return doc.getElementById(id);
}

Lazarus.build = 646;

//some form types used in the database.
Lazarus.FORM_TYPE_NORMAL = 0;
Lazarus.FORM_TYPE_AUTOSAVE = 1;
Lazarus.FORM_TYPE_STALE_AUTOSAVE = 2;
Lazarus.FORM_TYPE_TEMPLATE = 3;

//version number for saved forms
//increment this when making major changes to the way form info is saved/restored
//and you want to allow for legacy code. 
Lazarus.FORM_INFO_VERSION = 1;

/**
* return a browser window
*/
Lazarus.getBrowser = function(){
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	return wm.getMostRecentWindow("navigator:browser");
}

/**
* return an installed extension
*/
Lazarus.getExtension = function(extId, callback){
	
	//Fx 4
	var AddonManager;
	try {
		AddonManager = Components.utils.import("resource://gre/modules/AddonManager.jsm").AddonManager;
	}catch(e){}
	
	if (AddonManager){
		AddonManager.getAddonByID(extId, function(addon){
			callback(addon);
		});
	}
	//Fx 3
	else {
		var em = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
		// Change extension-guid@example.org to the GUID of the extension whose version
		// you want to retrieve, e.g. foxyproxy@eric.h.jung for FoxyProxy
		var addon = em.getItemForID(extId);
		setTimeout(function(){
			callback(addon);
		}, 1);
	}
}

/**
* return a human readable version string for lazarus
*/
Lazarus.getVersionStr = function(callback){
	Lazarus.getExtension(Lazarus.guid, function(addon){
		callback(addon.version);
	});
}

/**
* trims leading and trailing whitespace from a string
*/
Lazarus.trim = function(str){
	return str.replace(/^\s+/, '').replace(/\s+$/, '');
}

/**
* return true if value is in an array 
* strings do a case insensitive search 
*/
Lazarus.inArray = function(val, arr){
	if (typeof val == "string"){
		val = val.toLowerCase();
	}
	for (var i=0; i<arr.length; i++){
		var arrVal = (typeof arr[i] == "string") ? arr[i].toLowerCase() : arr[i];
		if (val == arrVal){
			return true;
		}
	}
	return false;
}


/**
* convert a (one dimentional) array of values onto a hash table 
*/
Lazarus.arrayToHashTable = function(arr){
	var table = {};
	for (var i=0; i<arr.length; i++){
		table[arr[i]] = true;
	}
	return table;
}

/**
* return TRUE if object is an array
*/
Lazarus.isArray = function(obj){
	return (typeof obj == "object" && typeof obj.length === 'number' && !obj.propertyIsEnumerable('length'));
}

/**
* return a nicely formatted date-time 
* default format is "YYYY-MM-DD HH:MM:SS"
*/
Lazarus.formatDate = function(date, justDate){
	var y = Lazarus.pad(date.getFullYear(), 4);
	var m = Lazarus.pad(date.getMonth()+1, 2);
	var d = Lazarus.pad(date.getDate(), 2);
	var h = Lazarus.pad(date.getHours(), 2);
	var n = Lazarus.pad(date.getMinutes(), 2);
	var s = Lazarus.pad(date.getSeconds(), 2);
	
	return (justDate) ? (y +"-"+ m +"-"+ d) : (y +"-"+ m +"-"+ d +" "+ h +":"+ n +":"+ s);
}


/**
* return a string form at of the number with commas
*/
Lazarus.formatNumber = function(num){
	var str = num.toString();
	
	//split into integer and decimal places
	var s = str.split(".");
	var sInt = s[0];
	var sDec = s[1] ? ("."+ s[1]) : '';
	var m;
	//add a comma between every 3 digits 
	while(m = sInt.match(/(\d+)(\d{3})/)){
		sInt = m[1] +","+ m[2]; 
	}
	//and re-attach any decimals
	return sInt + sDec;
}

/**
* pad a number to the appropriate length
*/
Lazarus.pad = function(num, minLen, padChar){
	padChar = padChar || "0"
	var s = num.toString();
	while (s.length < minLen){
		s = "0"+ s;
	}
	return s;
}


/**
* converts a URL string to a URI that is used in many firefox functions
*/
Lazarus.urlToURI = function(url){
	try {
		var uri = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI(url, null, null);
		//how screwed is this? if I try to access uri.host and the url doesn't have one (eg aim:bob) then an error is thrown!
		var safeURI = {}
		for(var key in uri){
			safeURI[key] = '';
			try {
				safeURI[key] = uri[key];
			}catch(e){}
		}
		return safeURI;
	}catch(e){
		return null;
	}
}



/**
* helper when calculating window size
*/
Lazarus.showWindowSizeHelper = function(){
	if (Lazarus.getBrowser().Lazarus.getExtPref("debugMode") >= 4){
		window.addEventListener("resize", function(){
			document.origTitle = document.origTitle || document.title;
			document.title = document.origTitle +": "+ window.outerWidth +" x "+ window.outerHeight;
		}, false);
	}
}

/**
* logging levels 
*/
Lazarus.DEBUG_TYPE_NONE = 0;
Lazarus.DEBUG_TYPE_ERROR = 1;
Lazarus.DEBUG_TYPE_WARNING = 2;
Lazarus.DEBUG_TYPE_MESSAGE = 3;

/**
* return TRUE if obj is an error
*/
Lazarus.isError = function(obj){
	//doesn't always work
	//return (obj instanceof Error);
	return (obj && obj.stack && obj.message);
}

/**
* logs a message to the error console
*/
Lazarus.logErrorMessage = function(args, type){
	
	var msg = "Lazarus: ";
	
	if (Lazarus.isError(args[0])){
		msg += args[0].message +"\n";
		for (var i=1; i<args.length; i++){
			msg += args[i] +"\n";
		}
	}
	else {
	   for (var i=0; i<args.length; i++){
			msg += args[i] +"\n";
		}
	}	
	
	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
	if (type == Lazarus.DEBUG_TYPE_MESSAGE){
		consoleService.logStringMessage(msg);
	}
	else {
		var scriptError = Components.classes["@mozilla.org/scripterror;1"].createInstance(Components.interfaces.nsIScriptError);
		var flag = (type == Lazarus.DEBUG_TYPE_WARNING) ? scriptError.warningFlag : scriptError.errorFlag;
		if (Lazarus.isError(args[0])){
			scriptError.init(msg, args[0].fileName, null, args[0].lineNumber, null, flag, "component javascript");
		}
		else {
			scriptError.init(msg, null, null, null, null, flag, "component javascript");
		}
		consoleService.logMessage(scriptError);   
	}
}
		
		
/**
* log an error to the error console
* err can be an Error object or a string
*/
Lazarus.error = function(){
	if (Lazarus.getPref("extensions.lazarus.debugMode") >= Lazarus.DEBUG_TYPE_ERROR){
		Lazarus.logErrorMessage(arguments, Lazarus.DEBUG_TYPE_ERROR);
	}
}

/**
* logs a warning message to the error console
*/
Lazarus.warning = function(){
	if (Lazarus.getPref("extensions.lazarus.debugMode") >= Lazarus.DEBUG_TYPE_WARNING){
		Lazarus.logErrorMessage(arguments, Lazarus.DEBUG_TYPE_WARNING);
	}
}

/**
* logs a message to the error console
*/
Lazarus.debug = function(){
	if (Lazarus.getPref("extensions.lazarus.debugMode") >= Lazarus.DEBUG_TYPE_MESSAGE){
		Lazarus.logErrorMessage(arguments, Lazarus.DEBUG_TYPE_MESSAGE);
	}
}

/**
* dump an object and all it's properties to the error console
*/
Lazarus.dump = function(obj){
	Lazarus.debug(Lazarus.formatObject(obj));
}

Lazarus.formatObject = function(obj, depth){
	var MAX_DEPTH = 5;
	depth = depth || 0;
	if (depth >= MAX_DEPTH){
		return "...";
	}
	
	var undefined;
	
	switch(typeof obj){
		case "string":
			return '"'+ obj +'"';
		case "number":
		case "boolean":
			return "["+ typeof obj +"] "+ obj;
		case "function":
			return obj.toString().replace(/\n(\w\W)*/, '');
		
		default:
			switch(obj){
				case null:
					return "[null]";
				case undefined:
					return "[undefined]";
				default:
					var tabs = "";
					for(var i=0; i<depth; i++){
						tabs += "\t";
					}
					//array
					if (typeof obj.length == "number"){
						var str = "[array "+ obj.length +"][\n";
						for (var i=0; i<obj.length; i++){
							str += tabs +"\t["+ i +"] "+ Lazarus.formatObject(obj[i], depth+1) +"\n";
						}
						str += tabs +"]";
						return str;
					}
					//or object
					else {
						var str = "[object] {\n";
						for(var prop in obj){
							str += tabs +"\t"+ prop +"=";
							try {
								str += Lazarus.formatObject(obj[prop], depth+1);
							}
							catch(e){
								str += "?";
							}
							str += "\n";
						}
						str += tabs +"}";
						return str;
					}
				break;
			}
		break;
	}
}


/**
* preference code (logging requires prefs)
*/
Lazarus.Pref = Lazarus.Pref || {};

/**
* "listens" for changes to the given preference and fires the given function when the preference changes
* ref: http://developer.mozilla.org/en/docs/Code_snippets:Preferences#Using_preference_observers
*/
Lazarus.Pref.addObserver = function(prefId, func){

	//split the prefId into branch and leaf
	var pos = prefId.lastIndexOf(".");
	if (pos == -1){
		throw Error("Pref.addObserver() prefId must contain a '.' ["+ prefId +"]");
	}
	
	var leaf = prefId.substr(pos);
	var branch = prefId.substr(0, pos);

	var observer = {
	  register: function(){
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		this._branch = prefService.getBranch(branch);
		this._branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this._branch.addObserver("", this, false);
	  },

	  unregister: function(){
		if (!this._branch) return;
		this._branch.removeObserver("", this);
	  },

	  observe: function(aSubject, aTopic, aData){
		if(aTopic != "nsPref:changed") return;
		
		//TODO: add "getPref" and pass new preference to function?
		if (aData == leaf){
			func();
		}
	  }
	}
	observer.register();
		window.addEventListener("unload", function(){
			observer.unregister();
		}, false);
		
	return observer;
}

/**
* forces Firefox to save the prefs file
*/
Lazarus.Pref.savePrefFile = function(key, val){
	var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	prefService.savePrefFile(null);
}


/**
* return a preference
*/
Lazarus.getPref = function(name, defaultVal){
	
	try {
		var branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		switch (branch.getPrefType(name)){
			case 32 : //string
				return  branch.getCharPref(name);
			case 64 : //int
				return branch.getIntPref(name);
			case 128: //bool
				return branch.getBoolPref(name);
			default:						
		}
	}
	catch(e){}
	
	if (typeof(defaultVal) !== "undefined"){
		return defaultVal;
	}
	else {
		throw Error("Lazarus: Unsupported preference datatype ["+ name +","+ branch.getPrefType(name) +"]");
	}
}

/**
* set a preference
*/
Lazarus.setPref = function(name, val){

	var branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	
	switch (typeof(val)){
		case "boolean":
			branch.setBoolPref(name, val);
			return true;
			
		case "string":
			branch.setCharPref(name, val);
			return true;
		
		case "number":
			branch.setIntPref(name, val);
			return true;
		
		default:
			throw Error("Unable to save pref of type "+ typeof(val));
	}
}

//increase a preference value by inc (default 1) 
//return the new value
Lazarus.incPref = function(name, inc){
	var newVal = Lazarus.getPref(name, 0) + (inc || 1);
	Lazarus.setPref(name, newVal);
	return newVal;
}


/**
* delete a pref branch
*/
Lazarus.killPref = function(name){
	var branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	branch.deleteBranch(name);
}

/**
* returns a preference from the "extensions.lazarus" branch
*/
Lazarus.getExtPref = function(key, defaultVal){
	return Lazarus.getPref("extensions.lazarus."+ key, defaultVal);
}

/**
* sets a preference in the "extensions.lazarus" branch
*/
Lazarus.setExtPref = function(key, val){
	return Lazarus.setPref("extensions.lazarus."+ key, val);
}

/**
* return the current documents URL
*/
Lazarus.currentURL = function(){
	try {
		return content.document.URL;
	}catch(e){
		return '';
	}
}



/**
* resize a preference window to fit the content of it's largest pane
*/
Lazarus.sizePrefWindowToContent = function(){
	// Localize strings aren't used when the initial height is used to calculate the size of the context-box
	// and preference window.  The height is calculated correctly once the window is drawn, but the context-box
	// and preference window heights are never updated.
	var panes = document.getElementsByTagName('prefpane');
	var diffX = 0;
	var diffY = 0;
	
	for (var i=0; i<panes.length; i++){
		var pane = panes[i];
		//we need to grab the boxObject of the container (XUL:vbox .content-box), not the pane itself (pane has padding which makes life difficult)
		var contentBox = pane.boxObject.firstChild.boxObject;
		
		//check to see if there are elements within the box that go beyond the boxes borders
		for (var j=0; j<pane.childNodes.length; j++){
			var child = pane.childNodes[j];
			if (child.boxObject){
				if ((child.boxObject.screenX + child.boxObject.width) > (contentBox.screenX + contentBox.width + diffX)){
					diffX = (child.boxObject.screenX + child.boxObject.width) - (contentBox.screenX + contentBox.width)
				}
				if ((child.boxObject.screenY + child.boxObject.height) > (contentBox.screenY + contentBox.height + diffY)){
					diffY = (child.boxObject.screenY + child.boxObject.height) - (contentBox.screenY + contentBox.height)
				}
			}
		}
	}
	
	if (diffX > 0 || diffY > 0){
		window.resizeTo(window.outerWidth + diffX, window.outerHeight + diffY);
	}
}

/**
* extract the key/value pairs from the query string of a url
*/
Lazarus.getUrlQuery = function(url){
	var uri = Lazarus.urlToURI(url);
	
	var query = uri.path.replace(/^[^\?]*\?/, '').replace(/#.*$/, '');
	
	//split the query string into key/value pairs
	var pairs = (query.indexOf("&amp;") > -1) ? query.split(/&amp;/g) : query.split(/&/g);
	
	//and then split each pair into its separate key/value
	var values = {};
	for(var i=0; i<pairs.length; i++){
	  var bits = pairs[i].split(/=/);
		var key = decodeURIComponent(bits[0]);
		var value = bits[1] ? decodeURIComponent(bits[1]) : '';
		if (typeof values[key] === "undefined"){
			values[key] = value;
		}
		else if (Lazarus.isArray(values[key])){
			values[key].push(value);
		}
		else {
			//need to turn the previous value into an array of values
			values[key] = new Array(values[key]);
			values[key].push(value);
		}
	}

	//return the key requested, or all keys
	return (arguments.length == 2) ? values[arguments[1]] : values;
}


if (this.JSON){
  Lazarus.JSON = {
    encode: function(obj){
      return JSON.stringify(obj);
    },
    decode: function(str){
      return JSON.parse(str);
    }
  }
}
else {
  Lazarus.JSON = {
    
    nsiJSON: Components.classes["@mozilla.org/dom/json;1"].createInstance(Components.interfaces.nsIJSON),
    
    encode: function(obj){
      return this.nsiJSON.encode(obj);
    },
    
    decode: function(str){
      return this.nsiJSON.decode(str);
    }
  }
}

