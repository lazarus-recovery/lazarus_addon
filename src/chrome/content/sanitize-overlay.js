
this.Lazarus = this.Lazarus || {};

Lazarus.initalized = false;

/**
* initalize window
*/
Lazarus.init = function(){
    if (!Lazarus.initalized){
        Lazarus.initalized = true;
        window.removeEventListener("load", Lazarus.init, false);
        
        //attach an event to the ondialogaccept command
        window.addEventListener("dialogaccept", Lazarus.onDialogAccept, false);
        
				//bugger! Firefox 3.5 introduces a remove search history by date option 
				//eg remove the last X hours. 
				if (Lazarus.$("detailsExpanderWrapper")){
					Lazarus.$('extensions.lazarus.privacy.item.saved.forms.checkbox').hidden = true;
				}
				else {
					//move our checkbox beneath the "Save form and search history" checkbox
					var lazBox = Lazarus.$('extensions.lazarus.privacy.item.saved.forms.checkbox');
					var checkboxes = document.getElementsByTagName("checkbox");
					for (var i=0; i<checkboxes.length; i++){
							var box = checkboxes[i];
							if (box.getAttribute("preference") == "privacy.item.formdata" && box.nextSibling){
									box.parentNode.insertBefore(lazBox, box.nextSibling);
									break;
							}
					}
					//if not found , leave at end of list
			}
   }
}

/**
* cleanup
*/
Lazarus.cleanup = function(){
    if (Lazarus.initalized){
        window.removeEventListener("dialogaccept", Lazarus.onDialogAccept, false);
    }
}

/**
* user hit "Clear Private Data Now"
*/
Lazarus.onDialogAccept = function(){
    
    if (Lazarus.$('extensions.lazarus.privacy.item.saved.forms.checkbox').checked){
        var browser = Lazarus.getBrowser();
        if (browser){
            browser.Lazarus.emptyDB(Lazarus.FORM_TYPE_TEMPLATE);
            browser.Lazarus.debug("ClearPrivateData: removing all forms");        
            //hitting clear now also logs a user out of the Software Security Device
            browser.Lazarus.refreshIcon();
        }
        else {
            /*
            if privacy.sanitize.promptOnSanitize = true and 
                privacy.sanitize.sanitizeOnShutdown = true
            then the Clear Private Data dialog is opened on shutdown.
            At this point there are no browser windows, so we cannot call any code from Lazarus.getBrowser()
            */
            //we need to connect to the database, and remove all forms (but not templates)
            Lazarus.db = new Lazarus.SQLite("%profile%/lazarus.sqlite");
						var ids = Lazarus.db.getColumn("SELECT id FROM forms WHERE savetype NOT IN ("+ Lazarus.FORM_TYPE_TEMPLATE +")");
						
						Lazarus.db.exe("DELETE FROM forms WHERE id IN ("+ ids.join(",") +")");
						Lazarus.db.exe("DELETE FROM forms_fulltext WHERE docid IN ("+ ids.join(",") +")"); 
						
						//and remove editor info too
						Lazarus.db.exe('DELETE FROM textdata');
						Lazarus.db.exe('DELETE FROM textdata_fulltext');
            
						Lazarus.db.close();
        }
    }
}

window.addEventListener("load", Lazarus.init, false);
window.addEventListener("close", Lazarus.cleanup, false);
