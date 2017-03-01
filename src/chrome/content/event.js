
/**
* === Custom events ===
*/
Lazarus.Event = {};

//hash table of active handlers
Lazarus.Event.handlers = {};

/* == list of firefox events ==

window-load		  :Window has loaded, gBrowser has been initalized
application-startup  :first window has loaded.
application-shutdown :last window has closed
window-unload		:Window is unloading

lazarus-installed   :Lazarus has been installed for the first time.
lazarus-updated	 :Extension is updating to a newer version.


extension-uninstall(ext) :Extension has been uninstalled, and browser is closing.
extension-uninstall-request(ext) :User has asked to have extension uninstall at new browser start.
extension-uninstall-cancel(ext)  :User has cancelled previous uninstall request.

*/


/**
* Add an event to the event queue
* create a new queue if one doesn't already exist
*/
Lazarus.Event.add = function(id, func){
	//keep the handlers case insensitive
	id = id.toLowerCase();
	
	//do not allow the same event to be added more than once.
	var handlers = Lazarus.Event.handlers[id] || [];
	for (var i=0; i<handlers.length; i++){
		if (handlers[i] === func){
			//handler already exists
			return false;
		}
	}
	handlers.push(func);
	Lazarus.Event.handlers[id] = handlers;
	return true;
}

/**
* Remove an event from the event queue
* Does nothing if the event doesn't exist in the queue
*/
Lazarus.Event.remove = function(id, func){
	id = id.toLowerCase();
	var handlers = Lazarus.Event.handlers[id] || [];
	var newHandlers = [];
	for (var i=0; i<handlers.length; i++){
		if (handlers[i] != func){
			newHandlers.push(handlers[i]);
		}
	}
	Lazarus.Event.handlers[id] = newHandlers;
}

/**
* Triggers an event
* Passes additional argument object to each of the event handlers in turn
* if any event handler returns FALSE, then event will halt (no more handlers will be called)
*/
Lazarus.Event.fire = function(id, args){
	if (args){
		Lazarus.debug("fire event: "+ id, args);
	}
	else {
		Lazarus.debug("fire event: "+ id);
	}
	id = id.toLowerCase();
	var handlers = Lazarus.Event.handlers[id] || [];
	for (var i=0; i<handlers.length; i++){
		try {
			if (handlers[i](args) === false){
				break;
			}
		}
		catch(e){
			Lazarus.error(e);		
		}
	}
}


/**
* return the number of current firefox windows
*/
Lazarus.Event.numOfBrowserWindows = function(){
//Use the nsIWindowManager to get a list of browser windows
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		   .getService(Components.interfaces.nsIWindowMediator);
	var en = wm.getEnumerator("navigator:browser");
	var c = 0;
	while(en.hasMoreElements()) {
		c++;
		en.getNext();
	}
	return c;
}


/**
* fire load and startup events
*/
Lazarus.Event.onWinLoad = function(){
	if (gBrowser && !Lazarus.Event.onWinLoad.fired){
		Lazarus.Event.onWinLoad.fired = true;
		window.removeEventListener("load", Lazarus.Event.onWinLoad, false);
		
		//check for updates/install events
		Lazarus.getVersionStr(function(currBuild){
		
			var prevBuild = Lazarus.getPref("extensions.lazarus.version");
			Lazarus.setPref("extensions.lazarus.version", currBuild);
			
			//KLUDGE: moving to using version string to look for updated versions
			if (!prevBuild && Lazarus.getPref("extensions.lazarus.build", 0)){
					Lazarus.killPref("extensions.lazarus.build", 0)
					prevBuild = "0.0.0";
			}
			
			if (!prevBuild){
					Lazarus.Event.fire("lazarus-installed");
			}
			else if (Lazarus.versionCompare(currBuild, prevBuild) == 1){
					Lazarus.Event.fire("lazarus-updated", prevBuild);
			}
			Lazarus.Event.fire("window-load");
			
			//if this is the first window, fire startup
			if (Lazarus.Event.numOfBrowserWindows() == 1){
					Lazarus.Event.fire("application-startup");
			}
			
			//look for webprogress events
			Lazarus.Event.progressListener.init();
		});
	}
}


/**
* handle the onunload event.
*/
Lazarus.Event.onWinUnload = function(evt){
	//the onUnload event if fired for a whole bunch of stuff 
	//including a couple of times at startup, so we need to make sure it's
	//the XUL document that is unloading.
	if (evt.target === document){
		window.removeEventListener("unload", Lazarus.Event.onWinUnload, true);
		Lazarus.Event.progressListener.cleanup();
		Lazarus.Event.fire("window-unload");
	}
}

/**
* check for uninstall events
*/
//ref: http://xulsolutions.blogspot.com/2006/07/creating-uninstall-script-for.html
Lazarus.Event.nsIObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);

Lazarus.Event.observer = {

	//dictionary of extensions waiting to be uninstalled
	extensionsToBeUninstalled : {},
	
	//array of events to observe
	topics : {
		//final application window is closing 
		"quit-application-granted" : function(subject, data){
		
			Lazarus.Event.fire("application-shutdown");
			
			for (var extId in Lazarus.Event.observer.extensionsToBeUninstalled){
				if (Lazarus.Event.observer.extensionsToBeUninstalled[extId]){
					Lazarus.Event.fire("extension-uninstall", extId);
				}
			}			
		},
		
		//extension manager actions (install/uninstall/uninstallrequest)
		"em-action-requested" : function(subject, data){
		
			//convert subject into something we can access
			subject.QueryInterface(Components.interfaces.nsIUpdateItem);
			switch (data){
				case "item-uninstalled":
					Lazarus.Event.fire("extension-uninstall-request", subject);
					Lazarus.Event.observer.extensionsToBeUninstalled[subject.id] = true;
					break;
				
				case "item-cancel-action":
					Lazarus.Event.fire("extension-uninstall-cancel", subject);
					Lazarus.Event.observer.extensionsToBeUninstalled[subject.id] = false;
					break;  

				default:
					//other extension manager event
			}
		}	  
	},
	
	//handle observe event
	observe : function(subject, topic, data){
		this.topics[topic](subject, data);
	},
	
	//start observing
	register : function() {
		for (topic in this.topics){
			Lazarus.Event.nsIObserverService.addObserver(this, topic, false);
		}
	},
	
	//stop observing
	unregister : function() {
		for (topic in this.topics){
			Lazarus.Event.nsIObserverService.removeObserver(this, topic);
		}
	}
}


/**
* nsIProgressListener
*/
Lazarus.Event.progressListener = {
	QueryInterface: function(aIID){
		if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
			aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
			aIID.equals(Components.interfaces.nsISupports)){
			return this;
		}
		else {
			throw Components.results.NS_NOINTERFACE;
		}
	},

	onLocationChange: function(aProgress, aRequest, aURI){
		Lazarus.Event.fire("location-change", aURI);
	},
	//unused
	onStateChange: function(){},
	onProgressChange: function(){},
	onStatusChange: function(){},
	onSecurityChange: function(){},
	onLinkIconAvailable: function(){},
	
	init: function(){
		gBrowser.addProgressListener(Lazarus.Event.progressListener, Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
	},
	
	cleanup: function(){
		gBrowser.removeProgressListener(Lazarus.Event.progressListener);
	}
}

/**
* add event handlers to this window
*/
Lazarus.Event.init = function(){
	window.addEventListener("load", Lazarus.Event.onWinLoad, false);
	window.addEventListener("unload", Lazarus.Event.onWinUnload, true);
	Lazarus.Event.observer.register();
		
		//cleanup if we're closing
		window.addEventListener("unload", function(){
			Lazarus.Event.observer.unregister();
		}, false);
}

