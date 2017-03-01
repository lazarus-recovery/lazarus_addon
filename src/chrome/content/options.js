

Lazarus.db = Lazarus.getBrowser().Lazarus.db;
Lazarus.Crypto = Lazarus.getBrowser().Lazarus.Crypto;
Lazarus.getString = Lazarus.getBrowser().Lazarus.getString;


/**
* enables/disabled the expire save forms textbox
*/
function toggleExpireSaveForms(enabled, focusOnTextField){
	Lazarus.$('extensions-lazarus-expireSavedFormsInterval').disabled = !enabled;
	Lazarus.$('extensions-lazarus-expireSavedFormsUnit').disabled = !enabled;
	if (enabled && focusOnTextField){
			Lazarus.$('extensions-lazarus-expireSavedFormsInterval').focus();
	}
}

/**
* set initial state of expire save forms textbox
*/
function initExpireSaveForms(){
    toggleExpireSaveForms(Lazarus.$('extensions-lazarus-expireSavedForms').checked);
}

/**
* disable RemoveForms button if there are no forms to remove
*/
function initRemoveForms(){
    var iForms = Lazarus.db.getInt("SELECT COUNT(*) as cnt FROM forms WHERE savetype != "+ Lazarus.FORM_TYPE_TEMPLATE);
    iForms += Lazarus.db.getInt("SELECT COUNT(*) as cnt FROM textdata");
    Lazarus.$('extensions.lazarus.removeForms').disabled = (iForms == 0);
}


function enterPassword(){
  if (!Lazarus.getBrowser().Lazarus.canDecrypt() && Lazarus.getBrowser().Lazarus.isPasswordSet()){
		return askForPassword();
	}
	else {
		return true;
	}
}

/**
* 
*/
function initTextLinks(){
    var labels = document.getElementsByTagName("label");
    for (var i=0; i<labels.length; i++){
        var label = labels[i];
        if (label.getAttribute("class").indexOf("text-link") > -1){
            label.addEventListener("click", function(){
                Lazarus.getBrowser().Lazarus.openURL(this.getAttribute("href"), true, true);
            }, true);
        }
    }
}


/**
* empty the saved forms database
*/
function removeForms(){
		Lazarus.getBrowser().Lazarus.removeForms(Lazarus.db.getColumn("SELECT id FROM forms WHERE savetype != "+ Lazarus.FORM_TYPE_TEMPLATE));
		Lazarus.db.exe("DELETE FROM textdata");
    Lazarus.db.exe("DELETE FROM textdata_fulltext");
    Lazarus.getBrowser().Lazarus.editorInfos = [];
    initRemoveForms();
    initDBStats();
}

/**
* 
*/
function openChangePasswordDialog(){
    window.open("chrome://lazarus/content/password.xul", "LazarusSetPassword", "chrome,dialog,modal,resizable,centerscreen");
    //we had better alter the UI to reflect any changes made to the password
    Lazarus.getBrowser().Lazarus.unloadPrivateKey();
    //they may have removed their password, if so then reloading the key will log them back in
    Lazarus.getBrowser().Lazarus.loadPrivateKey();
    refreshPasswordButtons();
}

/**
* 
*/
function openResetPasswordDialog(){
    window.open("chrome://lazarus/content/password-reset.xul", "LazarusResetPassword", "chrome,dialog,modal,resizable,centerscreen");
    //we had better alter the UI to reflect any changes made to the password
    Lazarus.getBrowser().Lazarus.unloadPrivateKey();
    Lazarus.getBrowser().Lazarus.loadPrivateKey();
    refreshPasswordButtons();
}



/**
* 
*/
function refreshPasswordButtons(){
    var usingPassword = Lazarus.getBrowser().Lazarus.isPasswordSet();    
    Lazarus.$('usePassword').checked = usingPassword
    Lazarus.$('changePassword').hidden = !usingPassword;
    Lazarus.$('resetPassword').hidden = !usingPassword;
    Lazarus.getBrowser().Lazarus.refreshIcon();
}


/**
* 
*/
function init(){
    
    Lazarus.$('extensions-lazarus-saveSearchForms-box').hidden = !(Lazarus.getExtPref("includeExperimental", false));
    Lazarus.$('extensions.lazarus.checkForUpdatesBeta').disabled = !(Lazarus.getExtPref("checkForUpdates"));
    
    initTextLinks();
    refreshPasswordButtons();
    initExpireSaveForms();
    initRemoveForms();
    Lazarus.sizePrefWindowToContent();
		if (!Lazarus.getPref("browser.preferences.animateFadeIn", false)){
			restoreCustomSize();
			window.addEventListener("resize", saveCustomSize, false);
		}
    
    initDBStats();
}

function initDBStats(){
  var dbFile = Lazarus.file.getFile("%profile%/lazarus.sqlite");
  Lazarus.$('db-path').value = Lazarus.getString('options.dbpath.label') +' '+ dbFile.path;
  Lazarus.$('db-size').value = Lazarus.getString('options.dbsize.label') +' '+ (dbFile.fileSize /(1024 * 1024)).toFixed(2) +' MB';
  
  var dbFile = Lazarus.file.getFile("%profile%/lazarus-backup.sqlite");
  var lastModified = (dbFile && dbFile.exists()) ?  new Date(dbFile.lastModifiedTime) : 0; 
  Lazarus.$('db-backup').value = Lazarus.getString('options.dbbackup.label') +' '+ ((lastModified) ? Lazarus.formatDate(lastModified) : Lazarus.getString('options.dbbackup.nobackup'));
}





function saveCustomSize(){
	Lazarus.setPref("extensions.lazarus.optionsDialog.width", window.outerWidth);
	Lazarus.setPref("extensions.lazarus.optionsDialog.height", window.outerHeight);
}


function restoreCustomSize(){
	var width = Lazarus.getPref("extensions.lazarus.optionsDialog.width", window.outerWidth);
	var height = Lazarus.getPref("extensions.lazarus.optionsDialog.height", window.outerHeight);
	window.resizeTo(width, height);
}

function askForPassword(){
    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
    var password = {value: ""};
    var check = {value: false};
    
		while(prompts.promptPassword(null, Lazarus.getBrowser().Lazarus.getString("password.dialog.title"), Lazarus.getBrowser().Lazarus.getString("password.dialog.label"), password, null, check)){
				if (Lazarus.getBrowser().Lazarus.loadPrivateKey(password.value)){
            return password.value;
        }
		}
		
    return false;
}


/**
* 
*/
function onUsePassword(checkbox){
    if (checkbox.checked){
        //attempting to set a password, 
        //open the set new password dialog box.
        window.open("chrome://lazarus/content/password.xul", "LazarusSetPassword", "chrome,dialog,modal,resizable,centerscreen");
        //we had better alter the UI to reflect any changes made to the password
        Lazarus.getBrowser().Lazarus.unloadPrivateKey();
        //if we were successful in setting a password then all is good,
        //otherwise we need to uncheck the checkbox to show that no password was set.
        //if they've set a blank password then we should log them back in
        Lazarus.getBrowser().Lazarus.loadPrivateKey();
        refreshPasswordButtons();
    }
    //attempting to uncheck, if the user has a password, then we need to confirm they know the password before the change take effect.
    else if (Lazarus.getBrowser().Lazarus.isPasswordSet()){
        var oldPassword = askForPassword();
        if (oldPassword){
            //remove the password, 
            var encb64Key = Lazarus.db.getStr("SELECT value FROM settings WHERE name = 'private-key'");
            //we need to unencrypt the private key
            var decb64Key = Lazarus.Crypto.AESDecrypt(encb64Key, oldPassword);
    
            //re-encrypt the private key with a blank password, and save it.
            var newb64Key = Lazarus.Crypto.AESEncrypt(decb64Key, '');
        
            //and save
            Lazarus.db.exe("DELETE FROM settings WHERE name = 'private-key'");
            Lazarus.db.exe("INSERT INTO settings (name, value) VALUES ('private-key', ?1)", newb64Key);
            
            //remove the password from the SSD if it exists
            Lazarus.getBrowser().Lazarus.removePassword();   
            
            //since we've changed the password, we'd better log the user out 
            Lazarus.getBrowser().Lazarus.unloadPrivateKey(); 
        
            //and log em in with the blank password
            Lazarus.getBrowser().Lazarus.loadPrivateKey();
        }
        //and update the UI
        refreshPasswordButtons();
    }
}

function onCleanDatabase(){
  //disable the clean database button
  Lazarus.$('extensions.lazarus.cleanDatabase').disabled = true;
  Lazarus.$('extensions.lazarus.cleanDatabaseProgress').hidden = false;
	
	//Firefox (3.6.8) hangs if Firebug (1.5.4, 1.6b1) is installed and we attempt to run this code in a background thread.
	//Now background tasks are hanging the browser (Fx 4.0b7) on close even when Firebug is not installed.
	//Fuck it, background tasks are now no longer useable for us. 
	// if (Lazarus.getBrowser().Firebug){
		setTimeout(function(){
			Lazarus.db.exe("VACUUM");
			Lazarus.$('extensions.lazarus.cleanDatabaseProgress').hidden = true;		
			Lazarus.$('extensions.lazarus.cleanDatabase').disabled = false;
			initDBStats();
		}, 1);
	// }
	// else {
		// Lazarus.backgroundTask(function(){
			// Lazarus.db.exe("VACUUM");
		// }, function(){
			// Lazarus.$('extensions.lazarus.cleanDatabaseProgress').hidden = true;
			// Lazarus.$('extensions.lazarus.cleanDatabase').disabled = false;
			// initDBStats();
		// });
	// }
}

function onRestoreDatabase(){
	if (enterPassword() && window.confirm(Lazarus.getString("restoreDatabase.warning"))){
    Lazarus.setPref("extensions.lazarus.restoreDatabase", true);
			//this is the tricky bit, we need to close this dialog (modal)
			//and then run some code on the main browser window
			var main = Lazarus.getBrowser();
			main.setTimeout(function(){
			  main.Lazarus.restart();
			}, 100);
			
      window.close();
  }
}

function onDeleteDatabase(){
	if (window.confirm(Lazarus.getString("deleteDatabase.warning"))){
			Lazarus.setPref("extensions.lazarus.deleteDatabase", true);
			//this is the tricky bit, we need to close this dialog (modal)
			//and then run some code on the main browser window
			var main = Lazarus.getBrowser();
			main.setTimeout(function(){
			  main.Lazarus.restart();
			}, 100);
			
      window.close();
	}
}

/**
* 
*/
function openTextManager(){
    Lazarus.getBrowser().Lazarus.openTextManager();
}

//refresh the statusbar icon (if the user has set/unset their password)
window.addEventListener("unload", Lazarus.getBrowser().Lazarus.refreshIcon, false);

Lazarus.showWindowSizeHelper();