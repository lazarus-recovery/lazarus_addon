/***
firefox is a tad different from all the rest, so here's what we're going to do.
the "background page" that all the other addons have, is going to be faked by adding
an iframe to the background.html page in firefox (it's a hidden window that's only loaded once whenever firefox is loaded)
the iframe will load chrome://lazarus/content/background.html and we'll run all our background (priviledged) code from there

Other platforms have limited priviledged "content" scripts that run within their own isolated world with the context of a given page
In firefox we'll fake that by using "Lazarus.Content.initDoc()" and passing in the document to add our events to

***/

Lazarus.logger = new Lazarus.Logger('[lazarus]', Lazarus.Logger.LOG_LEVEL_ERRORS);

        
(function(){

	//load the content scripts
	Lazarus.FirefoxOverlay = {

		browserInitialized: false,

		init: function(){
			if (!Lazarus.FirefoxOverlay.browserInitialized && window.gBrowser){
				Lazarus.FirefoxOverlay.browserInitialized = true;
				window.removeEventListener("load", Lazarus.FirefoxOverlay.init, false);
        Lazarus.FirefoxOverlay.loadBackgroundPage();
        Lazarus.FirefoxOverlay.initToolbarButton();
        Lazarus.FirefoxOverlay.initBrowser();
        
        Lazarus.getPref("debugMode", function(debugMode){
          Lazarus.logger.logLevel = debugMode;
        });
			}
		},
		
		initBrowser: function(){
			//FIXME: use progress listener instead so we can inject scripts before the DOM is ready?
			gBrowser.addEventListener("DOMContentLoaded", function(evt){
				var doc = evt.originalTarget;
				if (doc && doc instanceof HTMLDocument && doc.URL && doc.URL.match(/^http(s)?:/)){
					//inject scripts
          Lazarus.callBackground("Lazarus.Event.fire", ["FirefoxDocumentReady", doc]);
					Lazarus.Content.initDoc(doc);
				}
			}, true);
      
      //listen for tab changes and notify the background page of a URL change if it occurs
      gBrowser.tabContainer.addEventListener("TabSelect", function(evt){
        Lazarus.callBackground("Lazarus.Event.fire", ["FirefoxTabSelect", evt]);
      }, false);
      
      window.addEventListener("activate", function(evt){
        Lazarus.callBackground("Lazarus.Event.fire", ["FirefoxBrowserActivate", evt]);
      }, false);
		},
    
    
    
		
		
		loadBackgroundPage: function(){
			//find the background window
			var win = Components.classes["@mozilla.org/appshell/appShellService;1"].getService(Components.interfaces.nsIAppShellService).hiddenDOMWindow;
			if (!win.lazarusInitialized){
				win.lazarusInitialized = true;
				var doc = win.document;
				//add an iframe to the document that will load all of our code
        //this will prevent any conflict with other extensions and makes the background page 
        //behave much like a background page in a Chrome/Safari extension.
        //NOTE: this needs to be a priviledged iframe (type != "content")
				var iframe = doc.createElement('iframe');
				iframe.setAttribute('name', 'lazarus-background-window');
				//Safari doesn't fire an onload event when it loads background.html from it's cache
				//NOTE: we don't need to do this for Chrome or Safari as (AFAICT) their background pages are never cached 
				iframe.setAttribute('src', 'chrome://lazarus/content/background.html?_='+ Lazarus.Utils.microtime());
				doc.documentElement.appendChild(iframe);
				Lazarus.backgroundWindow = iframe.contentWindow;
				win.lazarusBackgroundWindow = iframe.contentWindow;
			}
      else {
        //background page is already loaded, and we're opening a new window.
        //we should refresh the toolbar icon for the new window
        Lazarus.callBackground("Lazarus.Background.refreshUI");
      }
		},
    
    
    initToolbarButton: function(){
      Lazarus.getPref("firefoxToolbarButtonInstalled", function(toolbarButtonInstalled){
        if (!toolbarButtonInstalled){
          Lazarus.FirefoxOverlay.installButton('nav-bar', 'lazarus-toolbar-button', 'stop-button');
          Lazarus.setPref("firefoxToolbarButtonInstalled", true);
        }
      });
    },
    
    /**
    * REF: https://developer.mozilla.org/En/Code_snippets:Toolbar#Adding_button_by_default
    * Installs the toolbar button with the given ID into the given
    * toolbar, if it is not already present in the document.
    *
    * @param {string} toolbarId The ID of the toolbar to install to.
    * @param {string} id The ID of the button to install.
    * @param {string} afterId The ID of the element to insert after. @optional
    */
    installButton: function(toolbarId, id, afterId){
      if (!document.getElementById(id)) {
        var toolbar = document.getElementById(toolbarId);

        // If no afterId is given, then append the item to the toolbar
        var before = null;
        if (afterId){
          var elem = document.getElementById(afterId);
          if (elem && elem.parentNode == toolbar){
            before = elem.nextElementSibling;
          }
        }

        toolbar.insertItem(id, before);
        toolbar.setAttribute("currentset", toolbar.currentSet);
        document.persist(toolbar.id, "currentset");

        if (toolbarId == "addon-bar"){
          toolbar.collapsed = false;
        }
      }
    }
	}

	window.addEventListener("load", Lazarus.FirefoxOverlay.init, false);
	
})();


