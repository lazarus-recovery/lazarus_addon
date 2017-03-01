
//declare namespace
this.Lazarus = this.Lazarus || {};

Lazarus.STATE_UNINITALIZED = 0; 
Lazarus.STATE_DISABLED = 1;
Lazarus.STATE_PASSWORD_REQUIRED = 2;
Lazarus.STATE_ENABLED = 3;
Lazarus.STATE_DISABLED_FOR_DOMAIN = 4;
Lazarus.STATE_PRIVATE_BROWSING = 5;
Lazarus.STATE_GENERATING_KEYS = 6;


Lazarus.LOGIN_HOSTNAME = 'chrome://lazarus';
Lazarus.LOGIN_REALM = 'Private Key Password';
Lazarus.LOGIN_USERNAME = 'lazarus-private-key';

Lazarus.IFRAME_NAME = '<content-editable-iframes>';
Lazarus.MIN_TEXT_NEEDED_TO_SHOW_NOTIFICATION = 512; //characters

//flag to indicate if this browser is ready yet.
Lazarus.initalized = false;

//timers
Lazarus.cleanupSavedFormsTimer = 0;
Lazarus.autoSaveFormTimer = 0;

//pointer to last autosave form.
Lazarus.currAutoSaveForm = null;

//pointer to the last editor (txetbox or iframe) that a user put input into.
Lazarus.currentEditor = null;

//flag to say if context menu is currently being shown
Lazarus.isContextMenuShowing = false;

/* known input types
case "text":
case "textarea":
case "file":
case "radio":
case "checkbox":
case "select":
case "password":
case "hidden":
case "submit":
case "reset":
case "button":
case "image":
*/


//array of editor infos that the user has typed into this session 
Lazarus.editorInfos = [];

/**
* window has loaded
*/
Lazarus.init = function(){
  
  Components.utils.import("resource://lazarus/global.js", Lazarus);
  Components.utils.import("resource://lazarus/crypto.js", Lazarus);
	
  Lazarus.initalized = true;
  Lazarus.initDevEnviroment();
  
  //set loading icon
  Lazarus.refreshIcon();
  Lazarus.repositionNotification();
  
  //Update UI elements 
	Lazarus.getVersionStr(function(version){
		Lazarus.$("lazarus-statusbaricon-tooltip-title").setAttribute("value", Lazarus.getString("lazarus.statusbarpanel.image.tooltip", version +" ["+ Lazarus.build +"]")); 
	});
	
  Lazarus.refreshMenuIcons();
  Lazarus.Pref.addObserver('extensions.lazarus.showContextMenuIcons', Lazarus.refreshMenuIcons);
  
  if (Lazarus.getPref('extensions.lazarus.showDonateNotification')){
    Lazarus.checkForDonateThanks();
  }
  
  Lazarus.Event.add("saving-form", Lazarus.showSaveIcon);
  Lazarus.Event.add("form-saved", Lazarus.hideSaveIcon);
  
  Lazarus.Event.add("saving-text", Lazarus.showSaveIcon);
  Lazarus.Event.add("text-saved", Lazarus.hideSaveIcon);
  
  //check crypto component (breaks a lot with various Linux builds)
  if (Lazarus.checkCrypto()){    
    //open the database
    if (Lazarus.initDB()){
			if (Lazarus.initEncryptionKeys()){
				if (Lazarus.loadPublicKey()){
					Lazarus.enable();
				}
				
				Lazarus.refreshIcon();  

				Lazarus.saveAutoSaveText();
				
				//remove expired forms
				Lazarus.cleanupSavedForms();   
			}
			//else we are generating new encryption keys, do nothing
			
			var interval = Lazarus.getPref("extensions.lazarus.autoCleanIdleInterval") * 60;
			if (interval){
				Lazarus.addIdleObserver(Lazarus.autoCleanDB, interval);
			}
    }
    else {
			//errors *should* have been thrown in the error console.
			//inform the user something went wrong :(
			Lazarus.error("Failed to load database");
			Lazarus.disable();
    }
  }
  else {
    Lazarus.error("Failed to load crypto component");
    Lazarus.disable();
  }
  Lazarus.refreshIcon();  
}

/**
* display the saving icon in the statubar
*/
Lazarus.showSaveIcon = function(){

  // Minimum time (in milliseconds) that the save icon is to remain visible
  var MIN_VISIBLE_TIME = 500; 
  var iconURL = "chrome://lazarus/skin/lazarus-save.png";  
  var tooltipId = "lazarus-statusbaricon-tooltip-enabled"     
    
  Lazarus.$("lazarus-statusbarpanel-image").setAttribute("src", iconURL);
  Lazarus.hideSaveIconTime = (new Date()).getTime() + MIN_VISIBLE_TIME;
}

Lazarus.hideSaveIcon = function(){
  
  
  var remaining = Lazarus.hideSaveIconTime - (new Date()).getTime();
  if (remaining > 0){
  setTimeout(Lazarus.hideSaveIcon, remaining);
  }
  else {
  Lazarus.refreshIcon();
  }
}




/**
* turn off the donate notifications if this user has donated.
*/
Lazarus.checkForDonateThanks = function(){

  var onload = function(uri){
  if (uri && uri.spec && uri.spec.indexOf('//lazarus.interclue.com/donate-thanks.html') < 999999){
    Lazarus.setPref('extensions.lazarus.showDonateNotification', false);
    Lazarus.Event.remove("location-change", onload);
  }
  }
  Lazarus.Event.add("location-change", onload);
}

/**
* check to make sure the crypto component has loaded correctly
*/
Lazarus.checkCrypto = function(){
	//getting rid of crypto components,
	//using js encryption instead.
	return true;
}

/**
* reposition the notification bar so that it's always the last element 
*/
Lazarus.repositionNotification = function(){
  //#124: Zotero compatiilty problem
  var notif = document.getElementById('lazarus-notification');
  notif.parentNode.appendChild(notif);
}



/**
* enables Lazarus for this browser
*/
Lazarus.enable = function(){
  
  //add preference observers
  Lazarus.Pref.addObserver("extensions.lazarus.expireSavedForms", Lazarus.startCleanupTimer);
  Lazarus.Pref.addObserver("extensions.lazarus.expireSavedFormsInterval", Lazarus.startCleanupTimer);
  Lazarus.Pref.addObserver("extensions.lazarus.showInStatusbar", Lazarus.refreshIcon);
  
  //we need to capture any onsubmit event from forms within a webpage
  gBrowser.addEventListener("submit", Lazarus.onFormSubmit, false);
  gBrowser.addEventListener("submit", Lazarus.saveLastSubmittedForm, false);
  gBrowser.addEventListener("DOMContentLoaded", Lazarus.autofillEvent, true);
  gBrowser.addEventListener("DOMContentLoaded", Lazarus.initRecoverForm, true);
  gBrowser.addEventListener("reset", Lazarus.onFormReset, false);
  gBrowser.addEventListener("change", Lazarus.onFormChange, false);
  //we also need to save forms if people are typing into them.
  gBrowser.addEventListener("keyup", Lazarus.onKeyUp, false);
  
	//kjd: removing lazarus icon for now
  //gBrowser.addEventListener("keydown", Lazarus.onKeyDown, false);
  
    
  //clear the saved forms if user wants to when "clear private data" is hit.
  Lazarus.$("Tools:Sanitize").addEventListener("command", Lazarus.fireClearPrivateDataIfNoPrompt, false);
  
  //add handlers to the context menu
  Lazarus.$("contentAreaContextMenu").addEventListener("popupshowing", Lazarus.onContextMenuShowing, false);
  Lazarus.$("contentAreaContextMenu").addEventListener("popuphidden", Lazarus.onContextMenuHide, false);
  
  //need events when a user changes the current document
  Lazarus.Event.add("location-change", Lazarus.onLocationChange);  
  
  Lazarus.Event.add("extension-uninstall", Lazarus.onUninstall);
  Lazarus.Event.add("extension-uninstall-request", Lazarus.onUninstallRequest);
  Lazarus.Event.add("application-startup", Lazarus.onStartUp);
  Lazarus.Event.add("application-startup", Lazarus.removeOldForms);
  Lazarus.Event.add("application-shutdown", Lazarus.fireClearPrivateDataOnShutdown);
  Lazarus.Event.add("application-shutdown", Lazarus.onShutdown);
  Lazarus.Event.add("clear-private-data", Lazarus.onClearPrivateData);
  
	setTimeout(function(){
		Lazarus.saveAutoSavedForms();
		Lazarus.startCleanupTimer();
		Lazarus.refreshIcon();    
	}, 1);
}


Lazarus.onKeyDown = function(evt){
  var ele = evt.target;
  
  //ignore if we have already attached an onblur handler to this element
  if (!ele.lazarusIconAdded){
  switch(Lazarus.getElementType(ele)){
    case "text":
    case "password":
    case "textarea":
    //are we saving this element?
    var form = Lazarus.findFormFromElement(ele);
    var editor = Lazarus.findEditorFromElement(ele);
    if ((form && Lazarus.shouldSaveForm(form)) || (editor && Lazarus.shouldSaveEditorInfo(form))){
      //highlight element
      Lazarus.addBackgroundIcon(ele);
    }
    else {
      //ignore furthur keypresses on this element?
    }
    
    default:
    //ignore this element
  }
  }
}


Lazarus.addBackgroundIcon = function(ele){

  if (!ele.lazarusIconAdded){
  ele.lazarusIconAdded = true;

  var doc = ele.ownerDocument;
  if (!doc.lazarusIcon){
    var div = doc.createElement('div');
    div.style.width = "11px";
    div.style.height = "14px";
    div.style.position = "absolute";
    div.style.background = "url("+ Lazarus.icon +") no-repeat center center";
    div.title = Lazarus.getString('Lazarus.savingText'); 
    doc.body.appendChild(div);
    doc.lazarusIcon = div;
  }
  //now position the image over the end of the textbox
  var rect = ele.getBoundingClientRect();
  doc.lazarusIcon.style.top = rect.top +"px";
  doc.lazarusIcon.style.left = (rect.right - parseInt(doc.lazarusIcon.style.width)) +"px";
  doc.lazarusIcon.style.display = "block";
  
  var onBlur = function(){
    //hide the icon
    doc.lazarusIcon.style.display = "none";
    ele.lazarusIconAdded = false;
  }
  
  //when adding the icon, we should hide it on blur
  ele.addEventListener("blur", onBlur, false);
  }
}


/**
* restart the browser
*/
Lazarus.restart = function(){

  //code copied from quickrestart extension (https://addons.mozilla.org/en-US/firefox/addon/quickrestart/)
  //who apparently copied it from chrome://toolkit/content/mozapps/extensions/extensions.js
  const nsIAppStartup = Components.interfaces.nsIAppStartup;
  // Notify all windows that an application quit has been requested.
  var os = Components.classes["@mozilla.org/observer-service;1"]
                     .getService(Components.interfaces.nsIObserverService);
  var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
                             .createInstance(Components.interfaces.nsISupportsPRBool);
  os.notifyObservers(cancelQuit, "quit-application-requested", null);
  // Something aborted the quit process. 
  if (cancelQuit.data)
    return;
  // Notify all windows that an application quit has been granted.
  os.notifyObservers(null, "quit-application-granted", null);
  // Enumerate all windows and call shutdown handlers
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var windows = wm.getEnumerator(null);
  while (windows.hasMoreElements()) {
    var win = windows.getNext();
    if (("tryToClose" in win) && !win.tryToClose())
      return;
  }
  Components.classes["@mozilla.org/toolkit/app-startup;1"].getService(nsIAppStartup)
            .quit(nsIAppStartup.eRestart | nsIAppStartup.eAttemptQuit);
            
}

/**
* turns Lazarus off for this browser
*/
Lazarus.disable = function(){
  
  //add preference observers
  Lazarus.Pref.addObserver("extensions.lazarus.expireSavedForms", Lazarus.startCleanupTimer);
  Lazarus.Pref.addObserver("extensions.lazarus.expireSavedFormsInterval", Lazarus.startCleanupTimer);
  Lazarus.Pref.addObserver("extensions.lazarus.showInStatusbar", Lazarus.refreshIcon);
  
  //we need to capture any onsubmit event from forms within a webpage
  gBrowser.removeEventListener("submit", Lazarus.onFormSubmit, false);
  gBrowser.removeEventListener("submit", Lazarus.saveLastSubmittedForm, false);
  gBrowser.removeEventListener("DOMContentLoaded", Lazarus.autofillEvent, true);
  gBrowser.removeEventListener("DOMContentLoaded", Lazarus.initRecoverForm, true);
  gBrowser.removeEventListener("reset", Lazarus.onFormReset, false);
  gBrowser.removeEventListener("change", Lazarus.onFormChange, false);
  //we also need to save forms if people are typing into them.
  gBrowser.removeEventListener("keyup", Lazarus.onKeyUp, false);
  
  //need events when a user changes the current document
  Lazarus.Event.remove("location-change", Lazarus.onLocationChange);
    
  //clear the saved forms if user wants to when "clear private data" is hit.
  Lazarus.$("Tools:Sanitize").removeEventListener("command", Lazarus.fireClearPrivateDataIfNoPrompt, false);
    
  Lazarus.stopCleanupTimer();
  
  //and close the database
  Lazarus.db.close();
  
  //update the statusbar image 
  Lazarus.refreshIcon();
}

/**
* return TRUE if we can encrypt a string (ie the Crypto component is working, and the public key exists)
*/
Lazarus.canEncrypt = function(){
  return Lazarus.Crypto.publicKey ? true : false;
}

Lazarus.canDecrypt = function(){
  return Lazarus.Crypto.privateKey ? true : false;
}



/**
* initalizes the lazarus recover-form page
*/
Lazarus.initRecoverForm = function(evt){
  var doc = evt.originalTarget;
  if (Lazarus.isDocRecoveryForm(doc)){
    doc.title = Lazarus.getString("recoverform.title");
    
    //Lazarus.$('heading', doc).innerHTML = Lazarus.getString("recoverform.title");
    Lazarus.$('description', doc).innerHTML = Lazarus.getString("recoverform.description");
    Lazarus.$('notes', doc).innerHTML= Lazarus.getString("recoverform.notes");
    
    Lazarus.$('form-url-label', doc).innerHTML= Lazarus.getString("recoverform.form.url");
    Lazarus.$('form-action-label', doc).innerHTML= Lazarus.getString("recoverform.form.action");
    Lazarus.$('notes', doc).innerHTML= Lazarus.getString("recoverform.notes");
    
    var m = doc.URL.match(/[\?&]id=(\d+)/)
    var id = m ? parseInt(m[1]) : -1;
    if (id > -1){
      var row = Lazarus.db.getRow("SELECT * FROM forms WHERE id = ?1", id);    
      if (row){
        if (Lazarus.canDecrypt()){
          var formInfo = Lazarus.JSON.decode(Lazarus.decrypt(row["forminfo"]));
          
          Lazarus.$('form-url', doc).innerHTML = formInfo.origURL ? Lazarus.generateLinkFromURL(formInfo.origURL) : '';
          Lazarus.$('form-action', doc).innerHTML = formInfo.action ? Lazarus.generateLinkFromURL(formInfo.action) : '';
          
          var form = Lazarus.buildForm(formInfo, doc);
          form.setAttribute("lazarus-form-id", row["formid"]);
          Lazarus.$('form-box', doc).appendChild(form);
          Lazarus.restoreForm(form, formInfo);
        }
        else {
          //need to explain to user why we cannot fill in the form 
          Lazarus.showNotificationBox("password-required");
        }
      }
      else {
        Lazarus.$('form-box', doc).innerHTML = Lazarus.getString("error.form.not.found");
        Lazarus.$('form-box', doc).className = "warning";
      }
    }
    else {
      Lazarus.$('form-box', doc).innerHTML = Lazarus.getString("error.form.not.found");
      Lazarus.$('form-box', doc).className = "warning";
    }
  }
}

/**
* return TRUE if the given document is the lazarus Recover Form page.
*/
Lazarus.isDocRecoveryForm = function(doc){
  return (doc && doc.URL && doc.URL.indexOf("chrome://lazarus/content/recover-form.html") == 0);
}

/**
* generate an HTML link given a url.
* if url is too long, then truncate url to maxChars
*/
Lazarus.generateLinkFromURL = function(url, maxChars){
  
  maxChars = maxChars || 50;
  
  if (/^(file|http|https):/.test(url)){
    var text = url;
    if (text.length > maxChars){
      text = text.substring(0, maxChars -3) +"...";
    }
    
    return '<a href="'+ Lazarus.htmlEncode(url) +'" title="'+ Lazarus.htmlEncode(url) +'">'+ Lazarus.htmlEncode(text) +'</a>';
  }
  else {
    return Lazarus.htmlEncode(url);
  }
}

/**
* encode a string for display in an html page
*/
Lazarus.htmlEncode = function(str){
  str = str.replace(/&/g, "&amp;");
  str = str.replace(/</g, "&lt;");
  str = str.replace(/>/g, "&gt;");
  str = str.replace(/"/g, "&quot;");
  return str;
}

/**
* builds an HTML form from a formInfo object
*/
Lazarus.buildForm = function(formInfo, doc){
  var form = doc.createElement("form");
  form.setAttribute("method", formInfo.method || "get");
  form.setAttribute("enctype", formInfo.enctype || "");
  //support for AJAX textareas
  form.isTextarea = formInfo.isTextarea;
  
  for(var name in formInfo.fields){
    for (var i=0; i<formInfo.fields[name].length; i++){
      var fieldInfo = formInfo.fields[name][i];
      var ele = null;
      var eleLabel = '';
      switch(fieldInfo.type){
        case "radio":
        case "checkbox":
          if (formInfo.version && formInfo.version >= 1 && fieldInfo.value && typeof fieldInfo.value.valueAttr != "undefined"){
            ele = doc.createElement("input");
            ele.setAttribute("type", fieldInfo.type);
            ele.setAttribute("value", fieldInfo.value.valueAttr);
            eleLabel = name +"["+ fieldInfo.value.valueAttr +"]";
          }
          break;
        
        case "password":
        case "hidden":
        case "file":
        case "text":
          ele = doc.createElement("input");
          ele.setAttribute("type", fieldInfo.type);
          break;

        case "textarea":
          ele = doc.createElement("textarea");
          break;

        case "select":
          if (formInfo.version && formInfo.version >= 1 && Lazarus.isArray(fieldInfo.value) && fieldInfo.value.length){
            ele = doc.createElement("select");
          
            for (var i=0; i<fieldInfo.value.length; i++){
              var opt = doc.createElement("option");
              opt.setAttribute("value", fieldInfo.value[i]);
              opt.appendChild(doc.createTextNode(fieldInfo.value[i]));
              ele.appendChild(opt);
            }
            if (fieldInfo.value.length > 1){
              ele.setAttribute("size", fieldInfo.value.length);
              ele.setAttribute("multiple", "true");
            }
          }
          break;
        
        //no saved
        case "submit":
        case "reset":
        case "button":
        case "image":
          break;
          
        case "iframe":
          //ignore iframes for now?
          break;
          
        default:
          Lazarus.error("Unknown element type ["+ fieldInfo.type +"]");
      }     
      
      if (ele){
        if (fieldInfo.type == "hidden"){
          form.appendChild(ele);
        }
        else {
          var box = doc.createElement("div");
          box.setAttribute("class", "form-field-box");
          
          var label = doc.createElement("label");
          var text = doc.createTextNode(eleLabel || name);
          label.appendChild(text);
          box.appendChild(label);
        
          ele.setAttribute("name", fieldInfo.name);
          ele.setAttribute("class", "form-field "+ fieldInfo.type);
          box.appendChild(ele);
          form.appendChild(box);
        }
      }
    }
  }
  
  return form;
}

/**
* save the last submitted form id for use in auto restore template
*/
Lazarus.saveLastSubmittedForm = function(evt){
  var form = Lazarus.findFormFromElement(evt.target);
  if (form){
    Lazarus.lastSubmittedFormId = Lazarus.getFormId(form);    
  }  
}

/**
* call autofill if this is a valid html document.
*/
Lazarus.autofillEvent = function(evt){
  if (evt.originalTarget instanceof HTMLDocument){
    Lazarus.autofillDoc(evt.originalTarget);
  }
}


/**
* convert a string of HTML into human readable text
*/
Lazarus.htmlToText = function(html){
  
  //replace headings (</h1>) and paragraph ends with 2 line breaks
  var text = html.replace(/\s*<\/((h\d)|p)\s*>\s*/ig," \n\n");
  
  //replace divs blocks with single line breaks
  text = text.replace(/\s*<(\/div)\b[^>]*>\s*/ig,"\n");
  
  //replace list items with line breaks and dots
  text = text.replace(/\s*<(li)\b[^>]*>\s*/ig,"\n * ");
  
  //replace line breaks
  text = text.replace(/<(br)\b[^>]*>/ig,"\n"); 
  
  //strip all other tags
  text = text.replace(/<(\/|\w)[^>]*>/g,' ');
  
  //convert html spaces into normal spaces
  text = text.replace(/&nbsp;/g, ' ');
  
  //compress whitespace
  text = text.replace(/[ \t\f\v]+/g, ' ');
  
  //never have more than 2 line breaks in a row.
  text = text.replace(/\n\s*?\n(\s*?\n)*/g, "\n\n");
  
  //and finally trim.
  text = text.replace(/^\s+/, '').replace(/\s+$/, '');
  
  return text;
}


/**
* return TRUE if forms on the given document should be saved 
*/
Lazarus.isValidDoc = function(doc){
  return (doc && doc.URL && /^(file|http|https):/.test(doc.URL));
}

/**
* autofills forms found in the given document with there respective templates if they exist
*/
Lazarus.autofillDoc = function(doc){

  if (Lazarus.isValidDoc(doc) && doc.forms && doc.forms.length){
    var rsAutoFillTemplates = Lazarus.db.rs("SELECT id, formid FROM forms WHERE autofill = 1 AND savetype = "+ Lazarus.FORM_TYPE_TEMPLATE +" ORDER BY created DESC");
    if (rsAutoFillTemplates.length > 0){
      var templates = {};
      //convert the template id's to a hash table
      //TODO: there should only ever be one autofill template for a given form
      //raise a warning if this is not the case
      for (var i=0; i<rsAutoFillTemplates.length; i++){
        templates[rsAutoFillTemplates[i]["formid"]] = rsAutoFillTemplates[i]["id"];
      }
      
      for (var i=0; i<doc.forms.length; i++){
        var form = doc.forms[i];
        var formId = Lazarus.getFormId(form);
        //only autofill if the form is empty, and the form hasn't just been submitted.
        if (formId != Lazarus.lastSubmittedFormId && templates[formId] && Lazarus.isFormEmpty(form)){
          //if the user has a password and is not yet logged in, then we cannot autofill the form
          if (Lazarus.canDecrypt()){
            var encryptedFormInfo = Lazarus.db.getStr("SELECT forminfo FROM forms WHERE id = ?1", templates[formId]);
            var formInfo = Lazarus.JSON.decode(Lazarus.decrypt(encryptedFormInfo));
            Lazarus.restoreForm(form, formInfo);
          }
          else {
            //need to explain to user why we cannot autofill the template.
            Lazarus.showNotificationBox("password-required-autofill");
            break;
          }
        }
      }
    }
  }
  
  //if this is the currently visible tab, then clear the lastSubmittedFormId
  if (content.document && doc === content.document){
    Lazarus.lastSubmittedFormId = null;
  }
}

/**
* return TRUE if the given form contains no user entered text.
*/
Lazarus.isFormEmpty = function(form){
  for (var i=0; i<form.elements.length; i++){
    var ele = form.elements[i];
    switch (Lazarus.getElementType(ele)){
      case "text":
      case "textarea":
      case "file":
      case "password":
        var text = Lazarus.getElementValue(ele);
        if (Lazarus.trim(text)){
          return false;
        }
        
      //ignore other input types
      default:
    }
  }
  return true;
}

/**
* initalise any developer specific functionality
*/
Lazarus.initDevEnviroment = function(){
  
  if (Lazarus.getExtPref("openErrorConsoleAtStartup", false)){ 
    //open the javascript console
    toJavaScriptConsole();
  }
  
  if (Lazarus.getExtPref("debugMode") >= 4){
    Lazarus.$('lazarus-statusbar-menuitem-test').hidden = false; 
  }
}

/**
* handle text within the address bar changing
*/
Lazarus.onLocationChange = function(evt){
  //only close the notification if current page was not the result of submitting a form.
  if (!Lazarus.lastSubmittedFormId){
    Lazarus.closeNotificationBox(true);
  }
  Lazarus.refreshIcon();
}

/**
* fire the "clear private data" event
*/
Lazarus.fireClearPrivateDataIfNoPrompt = function(){
  if (!Lazarus.getPref("privacy.sanitize.promptOnSanitize", true)){
    Lazarus.Event.fire("clear-private-data");
  }
}


/**
* return the current state of lazarus
*/
Lazarus.getState = function(){
  if (!Lazarus.initalized){
    return Lazarus.STATE_UNINITALIZED;
  }
  else if (Lazarus.Crypto.generatingKeys || Lazarus.cleaningDatabase){
    return Lazarus.STATE_GENERATING_KEYS;
  }
  else if (!Lazarus.canEncrypt()){
    return Lazarus.STATE_DISABLED;
  }
  else if (Lazarus.isDisabledByPrivateBrowsing()){
    return Lazarus.STATE_PRIVATE_BROWSING;
  }
  else if (Lazarus.isPageDisabled()){
    return Lazarus.STATE_DISABLED_FOR_DOMAIN;
  }
  else if (!Lazarus.canDecrypt()){
    return Lazarus.STATE_PASSWORD_REQUIRED;
  }
  //all good?
  else {
    return Lazarus.STATE_ENABLED;
  }
}

/**
* fix for multiline xul:description elements
*/
Lazarus.setDescriptionText = function(ele, text){
  for (var i=ele.childNodes.length-1; i>=0; i--){
    ele.removeChild(ele.childNodes[i]);
  }
  ele.appendChild(ele.ownerDocument.createTextNode(text));
}

/**
* updates the statusbar icon
*/
Lazarus.refreshIcon = function(){

  Lazarus.$("lazarus-statusbarpanel").hidden = !Lazarus.getExtPref("showInStatusbar");
  
  var iconURL = "";
  var tooltipId = "";
   
  switch (Lazarus.getState()){
    case Lazarus.STATE_ENABLED:
      iconURL = "chrome://lazarus/skin/lazarus.png";  
      tooltipId = "lazarus-statusbaricon-tooltip-enabled"     
      break;
    
    case Lazarus.STATE_GENERATING_KEYS: 
      iconURL = 'chrome://lazarus/skin/lazarus-loading.gif';
      tooltipId = 'lazarus-statusbaricon-tooltip-generatingkeys';
      break;
      
    case Lazarus.STATE_PASSWORD_REQUIRED:
      iconURL = "chrome://lazarus/skin/lazarus-login.png"; 
      tooltipId = "lazarus-statusbaricon-tooltip-passwordrequired";   
      break;   

    case Lazarus.STATE_DISABLED_FOR_DOMAIN:
      iconURL = "chrome://lazarus/skin/lazarus-disabled.png"; 
      tooltipId = "lazarus-statusbaricon-tooltip-disabledfordomain";   
      break; 
    
    case Lazarus.STATE_PRIVATE_BROWSING:
      iconURL = "chrome://lazarus/skin/lazarus-disabled.png";
      tooltipId = "lazarus-statusbaricon-tooltip-private-browsing";        
      break;
      
    case Lazarus.STATE_UNINITALIZED:
    case Lazarus.STATE_DISABLED:
    default:
      iconURL = "chrome://lazarus/skin/lazarus-disabled.png";
      tooltipId = "lazarus-statusbaricon-tooltip-disabled";
  }
  
  //this appears to screw over firefox, missing images and such, if called during startup?
  //NOTE: firfox must be completely closed for this effect, using "restart" will NOT recreate it.
  //Lazarus.setDescriptionText(Lazarus.$("lazarus-statusbaricon-tooltip-description"), tooltip);
  
  Lazarus.$("lazarus-statusbarpanel-image").setAttribute("src", iconURL);
  Lazarus.$("lazarus-statusbarpanel-image").setAttribute("tooltip", tooltipId);
}

/**
* displays the lazarus welcome message
*/
Lazarus.showWelcome = function(){
  //dont show the welcome message immediately, need to wait a sec so the 
  //browser is open, and we can center the dialog relative to it.
  //~ setTimeout(function(){
    //~ Lazarus.openOptionsDialog("welcome-pane");
  //~ }, 100);
  
  //hmmm, session recovery is happening after this event, 
  //which is replacing our tab with the recovered sessions tabs
	
	Lazarus.getVersionStr(function(version){
		setTimeout(function(){
			Lazarus.openLazarusWebsite("oninstall.html?ver="+ version);
		}, 3000);
	});
}

/**
* opens the lazarus onupdate page for this version of lazarus
*/
Lazarus.showUpdatePage = function(){
  //hmmm, session recovery is happening after this event, 
  //which is replacing our tab with the recovered sessions tabs
	Lazarus.getVersionStr(function(version){
		setTimeout(function(){
			Lazarus.openLazarusWebsite("onupdate.html?ver="+ version);
		}, 3000);
	});
}


/**
* handle when the first browser window is opened.
*/
Lazarus.onStartUp = function(){
  
}

/**
* onUninstall
*/
Lazarus.onUninstall = function(ext){
  
  if (ext.id == Lazarus.guid){
    
    //var msg = '';
    if (Lazarus.getExtPref("uninstall.removeSavedForms", false)){
      //remove database
      //unable to disconnect the database, so the best we can do is empty it. 
      Lazarus.emptyDB();
      
    }
    if (Lazarus.getExtPref("uninstall.removeUserSettings", false)){
      //cleanup prefs 
      Lazarus.killPref("extensions.lazarus");
      Lazarus.Pref.savePrefFile();
    }
  }
}

/**
* 
*/
Lazarus.onUninstallRequest = function(ext){
  if (ext.id == Lazarus.guid){
    //ask the user if we should remove their preferences/saved forms
    //we need this dialog to appear from the addons dialog (if it exists)
    //~ var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
    //~ var win = wm.getMostRecentWindow("Extension:Manager");
    
    //~ //if theres no extension manager window (eg all-in-one-sidebar)
    //~ //use this window to open the dialog
    //~ if (!win){
      //~ win = window;
    //~ }
    //disabling dialog, uninstall process is stuffed up
    //win.openDialog("chrome://lazarus/content/uninstall.xul", "LazarusUninstallOptions", "chrome,dialog,modal,resizable=yes,titlebar=yes");
  }
}


/**
* return TRUE if the given editor still exists in the browser
*/
Lazarus.editorExists = function(info){
  try {
    //KLUDGE:
    //if a page is refreshed then the page remains, even if you then navigate away from it.
    //it appears to still exist, even though the user cannot see it.
    if (Lazarus.isIframe(info.editor) && (!info.editor.contentWindow || !info.editor.contentWindow.document)){
      return false;
    }
    else {
      return (info.editor.ownerDocument.defaultView && (info.url == info.editor.ownerDocument.defaultView.top.location.href));
    }
  }
  catch(e){
    return false;
  }
}


Lazarus.saveEditorInfo = function(info, saveType){


  if (Lazarus.shouldSaveEditorInfo(info)){

    var textHash = Lazarus.md5(info.text);
    
    if (saveType == Lazarus.FORM_TYPE_AUTOSAVE){
      var record = Lazarus.db.getRow("SELECT id, text_hash FROM textdata WHERE domain_hash = ?1 AND savetype = ?2 LIMIT 1", info.domainHash, Lazarus.FORM_TYPE_AUTOSAVE);
      //if form hasn't changed
      if (record && record.text_hash == textHash){
        //do nothing...
      }
      //if it has changed, or doesn't exist yet, save the changes
      else {
        Lazarus.Event.fire("saving-text");
        Lazarus.debug("Saving textdata - autosave", info);
        if (record){
          Lazarus.db.exe("DELETE FROM textdata WHERE id = ?1", record.id);
          //and get rid of any fulltext index as well
          Lazarus.db.exe("DELETE FROM textdata_fulltext WHERE docid = ?1", record.id);
        }
        var encText = Lazarus.encrypt(info.text);
        var encSummary = Lazarus.encrypt(info.summary);
        
        var id = Lazarus.db.insert("INSERT INTO textdata (text_encrypted, summary_encrypted, created, domain_hash, url_encrypted, text_hash, text_length, savetype) \
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", 
          encText, encSummary, info.created, info.domainHash, info.urlEncrypted, textHash, info.text.length, Lazarus.FORM_TYPE_AUTOSAVE);
        
        //and update the full text index,
        if (!Lazarus.getPref('extensions.lazarus.disableSearch')){
          //we're going to add domain info into this as well
          var hashedText = Lazarus.hashText(info.text);
          hashedText += ' '+ Lazarus.hashText(info.domain.replace(/\./g, ' '));
          Lazarus.db.exe("INSERT INTO textdata_fulltext (docid, hashed_text) VALUES (?1, ?2)", id, hashedText);
        }
        Lazarus.Event.fire("text-saved");
      }
    }
    else {
      
      //if the info object already exists, with exactly the same text, then just update the timestamp
      var id = Lazarus.db.getInt("SELECT id FROM textdata WHERE domain_hash = ?1 AND text_hash = ?2 LIMIT 1", info.domainHash, textHash);
      if (id){
        Lazarus.debug("Updating textdata - perm", info);
        Lazarus.db.exe("UPDATE textdata SET created = ?1, savetype = ?2 WHERE id = ?3", info.created, Lazarus.FORM_TYPE_NORMAL, id);
      }
      //otherwise, insert a new info object
      else {
        Lazarus.Event.fire("saving-text");
        Lazarus.debug("Saving textdata - perm", info);
        var encText = Lazarus.encrypt(info.text);
        var encSummary = Lazarus.encrypt(info.summary);
        
        var id = Lazarus.db.insert("INSERT INTO textdata (text_encrypted, summary_encrypted, created, domain_hash, url_encrypted, text_hash, text_length, savetype) \
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", 
          encText, encSummary, info.created, info.domainHash, info.urlEncrypted, textHash, info.text.length, Lazarus.FORM_TYPE_NORMAL);
        
        if (!Lazarus.getPref('extensions.lazarus.disableSearch')){
          var hashedText = Lazarus.hashText(info.text);
          hashedText += ' '+ Lazarus.hashText(info.domain.replace(/\./g, ' '));
          Lazarus.db.exe("INSERT INTO textdata_fulltext (docid, hashed_text) VALUES (?1, ?2)", id, hashedText);
        }
        Lazarus.Event.fire("text-saved");
      }
    }
  }
}


/**
* genereate a random seed for use in the hashing function
*/
Lazarus.generateRandomHashSeed = function(){
  var rnd = Math.random().toString() +':'+ Lazarus.timestamp(true).toString();
  return Lazarus.FNV1a(rnd);
}


/**
* hashes individual words in a bunch of text
*/
Lazarus.hashText = function(text){

  //we'll need to grab the seed from the database.
  var seed = Lazarus.db.getStr("SELECT value FROM settings WHERE name = 'hash-seed'");
  
  if (!seed){
    seed = Lazarus.generateRandomHashSeed();
    Lazarus.db.exe("INSERT INTO settings (name, value) VALUES ('hash-seed', ?1)", seed);
    //and delete the full text index, because none of the others will work any more
    Lazarus.db.exe("DELETE FROM textdata_fulltext");    
  }
  
  //var p = new Profiler("hashedText: "+ text.length);
  var map = {};
  //p.mark("setup");
  
  //remove all non-text characters (strip HTML?)
  text = Lazarus.trim(text.toLowerCase().replace(/[^\s\w\-_]+/g, ' '));
  //p.mark("remove non-text: "+ text.length);
  
  var words = text.split(/\s+/g);
  //p.mark("split into words : "+ words.length);
		//we should also remove useless words (like "the", "and", "as" etc...)
  var len = words.length;
  var hashedWords = [];
  for (var i=0; i<len; i++){
    var word = words[i];    
    if (!map[word]){
      map[word] = Lazarus.FNV1a(word, seed);
    }
    hashedWords.push(map[word]);
  }
  //p.mark("hash words");
  
  //hashed text comes out at 70,000 characters for a 56,000 character start.
  //acceptable.
  var hashedText = hashedWords.join(" ");
  //debug(p.stop("join text: "+ hashedText.length));
  return hashedText; 
}


/**
* hash text within a MATCH query whilst keeping SQLite MATCH keywords/characters
*/
Lazarus.hashQuery = function(query){
  //phrase searches ('"broccoli cheese"')
  //Excluding terms ('onions -celery')
  //OR queries ('onions OR cheese')
  //Prefix search ('ch*') cannot be used due to hashing of the text strings.
  return query.replace(/\w+/g, function(m){
    if (m.toLowerCase() == "or"){
      return "OR";
    }
    else {
      return Lazarus.hashText(m);
    }
  });
}

Lazarus.saveAutoSaveText = function(){
  Lazarus.db.exe("UPDATE textdata SET savetype = ?1 WHERE savetype = ?2", Lazarus.FORM_TYPE_NORMAL, Lazarus.FORM_TYPE_AUTOSAVE);
}

Lazarus.autoSaveEditors = function(){
  
  //NOTE: traversing backwards through the list so we can remove items without it affecting 
  //the rest of the list
  var removed = [];
  
  for (var i=Lazarus.editorInfos.length-1; i>=0; i--){
    var info = Lazarus.editorInfos[i];
    //the page may have been submitted, or closed without submitting
    //if the editor is suddenly empty, we should assume it has been submitted (possibly via AJAX)
    if (!Lazarus.editorExists(info) || Lazarus.getEditorInfo(info.editor).isEmpty){
      removed.push(info);
      Lazarus.editorInfos.splice(i, 1);
    }
  }
  
  //and save any that have been removed
  for (var i=0; i<removed.length; i++){
    Lazarus.saveEditorInfo(removed[i]);
  }
  
  //we also want to update the current textbox (if any)
  
  //all others should be saved as "temporary saves"
  for (var i=0; i<Lazarus.editorInfos.length; i++){
    if (Lazarus.editorInfos[i].editor === Lazarus.currentEditor){
      Lazarus.saveEditorInfo(Lazarus.editorInfos[i], Lazarus.FORM_TYPE_AUTOSAVE);
      break;
    }
  }
  
  if (Lazarus.editorInfos.length == 0){
    Lazarus.stopEditorAutoSaveTimer();
  }
}


/**
* return the previous editosInfo 
*/
Lazarus.getPreviousEditorInfo = function(editor){
  for (var i=0; i<Lazarus.editorInfos.length; i++){
    if (Lazarus.editorInfos[i].editor === editor){
      return Lazarus.editorInfos[i];
    }
  }
  return null;
}


/**
* remove an editor info object from our list
*/
Lazarus.removeEditorInfo = function(info){
  for (var i=0; i<Lazarus.editorInfos.length; i++){
    if (Lazarus.editorInfos[i].editor === info.editor){
      Lazarus.editorInfos.splice(i, 1);
      return true;
    }
  }
  return false;
}


/**
* update editor info
*/
Lazarus.updateEditorInfo = function(info){
  for (var i=0; i<Lazarus.editorInfos.length; i++){
    if (Lazarus.editorInfos[i].editor === info.editor){
      Lazarus.editorInfos[i] = info;
      return true;
    }
  }
  return false;
}



/**
* save forms if people are typing into them
*/
Lazarus.onKeyUp = function(evt){
  //dont save form for every keypress (CPU hog)
  //we'll restart a timer whenever a key is pressed, 
  //and save when the timer fires.
  var form = Lazarus.findFormFromElement(evt.target);
  
  if (Lazarus.isPageDisabled()){
    return;
  }
  
  //if the event happened within a form, set a timer to auto save the form
  if (form && form.ownerDocument instanceof HTMLDocument){
    Lazarus.restartAutoSaveTimer(form);
  }
  
  //we'll do the same for textarea's and contentEditable iframes
  var editor = Lazarus.findEditorFromElement(evt.target);
  
  if (editor){
  
    Lazarus.currentEditor = editor;
    
    var info = Lazarus.getEditorInfo(editor);
    var prevInfo = Lazarus.getPreviousEditorInfo(editor);
    
    if (prevInfo){
      //if the textbox is suddenly empty, the form may have been submitted or reset (or all contents removed (ctrl+a + del))
      if (info.isEmpty){
        Lazarus.saveEditorInfo(prevInfo);
        //then remove the editorInfo from the list
        Lazarus.removeEditorInfo(prevInfo);
      }
      //otherwise update the previous editorInfo, and wait for the timer to save it.
      else {
        Lazarus.updateEditorInfo(info);
      }
    }
    //this is the first time the user has typed into this textbox
    //save it, if it's got some text in it
    else if (!info.isEmpty){
      Lazarus.editorInfos.push(info);
      Lazarus.restartEditorAutoSaveTimer();
    }
    else {
      //editor is empty, dont keep it
    }
    
    Lazarus.restartEditorAutoSaveTimer();
  }
}


/**
* return an editor info object
*/
Lazarus.getEditorInfo = function(editor){
  var info = {}
  info.editor = editor;
  info.text = Lazarus.extractText(editor);
	if (Lazarus.getExtPref("replaceCreditCardNumbers")){
		info.text = Lazarus.replaceCreditCardNumbers(info.text);
	}
	
  info.isEmpty = Lazarus.isEditorEmpty(editor);
  info.summary = Lazarus.generateSummary(info.text);
  info.created = Lazarus.timestamp();
  info.domain = Lazarus.getDomainFromElement(editor);
  info.domainHash = Lazarus.md5(info.domain);
  info.basedomain = Lazarus.getBaseDomain(info.domain);
  info.url = editor.ownerDocument.defaultView.top.location.href;
  info.urlEncrypted = Lazarus.encrypt(info.url);
  return info;
}


/**
* return TRUE if the editor doesn't contain any text 
*/
Lazarus.isEditorEmpty = function(editor){
  var text = Lazarus.extractText(editor);
  var type = editor.nodeName.toLowerCase();
  if (type == "textarea"){
    return text.match(/^\s*$/) ? true : false;
  }
  else if (type == "iframe"){
    return text.replace(/(<(\/|\w)[^>]*>)|(&nbsp;)/g, '').match(/^\s*$/) ? true : false;
  }
  else {
    throw Error("Unknown editor type: "+ type);
  }
}

/**
* return the text/html from an editable iframe or textarea
*/
Lazarus.extractText = function(ele){
  var text = '';
  if (Lazarus.isTextarea(ele)){
    text = (typeof ele.value == "string") ? ele.value : '';
  }
  else if (Lazarus.isIframe(ele)){
    text = (typeof ele.contentWindow.document.body.innerHTML) ? ele.contentWindow.document.body.innerHTML : '';
  }
  return Lazarus.trim(text);
}


/**
* generate a safe summary for display within a XUL:menuitem or XUL:tooltip
*/
Lazarus.generateSummary = function(text){
  //strip html
  text = Lazarus.htmlToText(text);
  return (text.length > 255) ? (text.substr(0, 252) +"...") : text;
}

Lazarus.restartEditorAutoSaveTimer = function(){
  Lazarus.stopEditorAutoSaveTimer();
  Lazarus.editorAutoSaveFormTimer = setInterval(Lazarus.autoSaveEditors, Lazarus.getExtPref("autoSaveInterval", 5000));
}
Lazarus.stopEditorAutoSaveTimer = function(){
  if (Lazarus.editorAutoSaveFormTimer){
    clearInterval(Lazarus.editorAutoSaveFormTimer);
  }
}


/**
* start the autosave timer 
*/
Lazarus.restartAutoSaveTimer = function(form){
  Lazarus.stopAutoSaveTimer();
  //we'll save the form here, so we can retrieve it when the timer fires
  Lazarus.currAutoSaveForm = form;
  Lazarus.autoSaveFormTimer = setTimeout(Lazarus.autoSaveForm, Lazarus.getExtPref("autoSaveInterval", 5000));
}

/**
* stops the autosave timer.
*/
Lazarus.stopAutoSaveTimer = function(){
  if (Lazarus.autoSaveFormTimer){
    clearTimeout(Lazarus.autoSaveFormTimer);
  }
}

/**
* run cleanup for this window
*/
Lazarus.cleanup = function(){
  gBrowser.removeEventListener("keyup", Lazarus.onKeyUp, false);
  gBrowser.removeEventListener("submit", Lazarus.onFormSubmit, false);
  gBrowser.removeEventListener("reset", Lazarus.onFormReset, false);
  gBrowser.removeEventListener("change", Lazarus.onFormChange, false);
  Lazarus.$("Tools:Sanitize").removeEventListener("command", Lazarus.fireCLearPrivateDataIfNoDialog, false);
  Lazarus.stopCleanupTimer();
}

/**
* handle last browser window shutting down 
*/
Lazarus.onShutdown = function(){
  
}

/**
* 
*/
Lazarus.onContextMenuHide = function(){
  Lazarus.isContextMenuShowing = false;
}


/**
* show or hide the menu item depending on what item caused the context menu to appear.
*/
Lazarus.onContextMenuShowing = function(evt){

  //we need to set a flag to prevent new autosaves whilst the context menu is shown
  Lazarus.isContextMenuShowing = true;
  
  //this event is fired whenever a submenu is shown, as well as when the main context menu it shown 
  //bugfix: only re-calculate the popup menu when it's first opened.
  //trying to alter the initial menu when a submenu is opened can cause the browser to hang.

  //hmmm this is causing a noticable hang when the form contains a lot (30k) of info
  //as a workaround, we will not calculate any submenu until the submenu is opened.
  var evtTargetId = evt.target.id;
  
  //quick check 
  if (evtTargetId != "contentAreaContextMenu" && evtTargetId != "lazarus-restoreform-submenu-menupopup" && evtTargetId != "lazarus-restoretext-submenu-menupopup"){
    return;
  }
  
  
  //did the user click on a form?
  var form = Lazarus.findFormFromElement(gContextMenu.target);
  var editor = Lazarus.findEditorFromElement(gContextMenu.target);
  
  if (evtTargetId == "contentAreaContextMenu"){
      
    //assume we should not show any menuitems
    var showMainMenu = false;
    var showSubMenu = false;
    var showLogin = false;
    var showSaveForm = false;
    var showPageDisabled = false;
    var showPrivateBrowsing = false;
    
    var showRestoreText = false;
    var showRestoreTextDisabled = false;
    
  
    if (!form && !editor){
      //dont show anything
    }
    else if (Lazarus.isDisabledByPrivateBrowsing()){
      showPrivateBrowsing = true;
    }
    else if (Lazarus.isPageDisabled(form.ownerDocument.URL)){
      showPageDisabled = true;
    }
    else if (!Lazarus.canDecrypt()){  
      showLogin = true;
    }
    else {
      if (form){ 
        
        showSaveForm = true;   
        var savedForms = Lazarus.getFormInfo(form, "id, formid, created, savetype, forminfohash, formtext, formname");
        
        //just show the one menu item, but dont show it if the form is identical to this one.
        if (savedForms.length == 1){
          showMainMenu = true;
          var info = Lazarus.formInfo(form);
          
          var infoHash = Lazarus.generateHash(info.fields);
          
          if (infoHash == savedForms[0]["forminfohash"]){
            Lazarus.$('lazarus-restoreform-contextmenuitem').setAttribute('src', "chrome://lazarus/skin/lazarus-disable.png");
            Lazarus.$('lazarus-restoreform-contextmenuitem').setAttribute('disabled', "true");
            Lazarus.$('lazarus-restoreform-contextmenuitem').setAttribute('tooltiptext', Lazarus.getString("form.is.equal"));
          }
          else {
            var savedForm = savedForms[0];
            Lazarus.$('lazarus-restoreform-contextmenuitem').setAttribute('src', "chrome://lazarus/skin/lazarus.png");
            Lazarus.$('lazarus-restoreform-contextmenuitem').setAttribute('lazarus-forms-id', savedForm["id"]);
            Lazarus.$('lazarus-restoreform-contextmenuitem').setAttribute('tooltiptext', Lazarus.generateSavedFormTooltip(savedForm));
            Lazarus.$('lazarus-restoreform-contextmenuitem').setAttribute('disabled', "");  
          }    
        }
        //show submenu 
        else if (savedForms.length > 1){
          showSubMenu = true;
        }
      }
      
      if (editor){
        showRestoreTextDisabled = true;
        //do we have any text saved for this domain/basedomain?
        var domain = Lazarus.getDomainFromElement(editor);
        if (domain){
          var domainHash = Lazarus.md5(domain);
          if (Lazarus.db.getInt("SELECT count(id) FROM textdata WHERE domain_hash = ?1 LIMIT 1", domainHash)){
            showRestoreText = true;
            showRestoreTextDisabled = false;
          }
        }
      }
    }
    
    //only show our menu item if over a form.
    Lazarus.$('lazarus-restoretextdisabled-contextmenuitem').hidden = !showRestoreTextDisabled;
    Lazarus.$('lazarus-restoretext-submenu').hidden = !showRestoreText;
    Lazarus.$('lazarus-restoreform-contextmenuitem').hidden = !showMainMenu;
    Lazarus.$('lazarus-restoreform-submenu').hidden = !showSubMenu;
    Lazarus.$('lazarus-enterpassword-contextmenuitem').hidden = !showLogin;
    Lazarus.$('lazarus-domaindisabled-contextmenuitem').hidden = !showPageDisabled;
    Lazarus.$('lazarus-privatebrowsing-contextmenuitem').hidden = !showPrivateBrowsing;
  }
  else if (evtTargetId == "lazarus-restoreform-submenu-menupopup" && form){
    Lazarus.buildSubMenu(form);
  }
  else if (evtTargetId == "lazarus-restoretext-submenu-menupopup" && editor){
    Lazarus.buildRestoreTextSubMenu(editor);
  }
}



Lazarus.getDomainFromElement = function(ele){
  try {
    return ele.ownerDocument.defaultView.top.location.host;
  }
  catch(e){
    return null;
  }
} 

/**
* builds the list of items that can be restored for this editor element
*/
Lazarus.buildRestoreTextSubMenu = function(editor){
  //
  var menu = Lazarus.$("lazarus-restoretext-submenu-menupopup");
  //remove all the current submenu items
  while(menu.lastChild){
    menu.removeChild(menu.lastChild);
  }
  
  var domainHash = Lazarus.md5(Lazarus.getDomainFromElement(editor));
  
  //and build the new ones
  var items = Lazarus.db.rs("SELECT id, text_hash, summary_encrypted, created FROM textdata WHERE domain_hash = ?1 ORDER BY created DESC LIMIT ?2", domainHash, Lazarus.getPref('extensions.lazarus.maxTextItemsInSubmenu', 20));
  
  var text = Lazarus.extractText(editor);
  var textHash = Lazarus.md5(text);
  
  for (var i=0; i<items.length; i++){
    var item = items[i];
    var menuitem = document.createElement("menuitem");
    
    if (Lazarus.getExtPref("showFormTextInSubMenu") && Lazarus.canDecrypt()){
      var summary = Lazarus.decrypt(item["summary_encrypted"]);
      menuitem.setAttribute("label", summary);
      menuitem.setAttribute("tooltiptext", summary);
    }
    else {
      var time = Lazarus.timestamp();
      menuitem.setAttribute("label", Lazarus.getTimeString(time - item["created"]));
      //show the tooltip if possible
      if (Lazarus.canDecrypt()){
        menuitem.setAttribute("tooltiptext", Lazarus.decrypt(item["summary_encrypted"]));
      }
    }
    
    menuitem.setAttribute("lazarus-restoretext-id", item["id"]);
    menuitem.setAttribute("oncommand", "Lazarus.onRestoreTextMenuItem(this)");
          
    //disable the menu item if the form is identical
    if (item["text_hash"] == textHash){
      menuitem.setAttribute('tooltiptext', Lazarus.getString("text.is.equal"));
      menuitem.setAttribute('disabled', "true");
    }
    menu.appendChild(menuitem);
  }
}

/**
* 
*/
Lazarus.getFormRestoredNotificationText = function(charsRestored, msgId){
  //we're trying out a bunch of text at the moment
  var numChars = Lazarus.formatNumber(charsRestored);
  var numForms = Lazarus.formatNumber(Lazarus.db.getInt("SELECT COUNT(*) FROM forms"));
  var numText = Lazarus.formatNumber(Lazarus.db.getInt("SELECT COUNT(*) FROM textdata"));
  
  var msgs = [
    'Lazarus has just saved you from having to retype '+ numChars +' characters. If you feel this has helped you, then please consider donating to this project so we can make Lazarus even better.',
    'Lazarus restored '+ numChars +' characters.\nDatabase contains '+ numForms +' Forms and '+ numText +' Text-blocks.',
    'Lazarus restored '+ numChars +' characters.\nDatabase contains '+ numForms +' Saved Forms and '+ numText +' Textareas.',
    'Lazarus resurrected '+ numChars +' characters.\nLazarus is securely storing '+ numForms +' Forms and '+ numText +' Text-blocks'
  ];
  
  return msgs[msgId];
}


/**
* 
*/
Lazarus.onRestoreTextMenuItem = function(menuitem){
  if (!Lazarus.canDecrypt()){
    Lazarus.debug("Unable to restore form, password required");
    Lazarus.showNotificationBox("password-required"); 
    return;
  }
  
  var editor = Lazarus.findEditorFromElement(gContextMenu.target);
  
  if (editor){
    var id = parseInt(menuitem.getAttribute("lazarus-restoretext-id"));
    
    Lazarus.debug("Attempting to restore text: "+ id);
    
    var enc_text = Lazarus.db.getStr("SELECT text_encrypted FROM textdata WHERE id = ?1", id);
    if (enc_text){
      var text = Lazarus.decrypt(enc_text);
      if (text){
        Lazarus.setElementValue(editor, text);   
        Lazarus.incPref("extensions.lazarus.restoreFormCount");
        if ((text.length > Lazarus.MIN_TEXT_NEEDED_TO_SHOW_NOTIFICATION) && Lazarus.getPref("extensions.lazarus.showDonateNotification") && Lazarus.getPref("extensions.lazarus.restoreFormCount", 0) > 3){
          var msgId = Math.floor(Math.random() *  4);
          Lazarus.showNotificationBox("form-restored", Lazarus.getFormRestoredNotificationText(text.length, msgId), "msgid-"+ msgId);            
        }
      }
      else {
        alert(Lazarus.getString("error.form.db.corrupt"));
      }
    }
    else {
      Lazarus.error("Unable to find textdata: "+ id);
      alert(Lazarus.getString("error.form.not.found"));
    }
  }
  else {
    //should never get here
    alert(Lazarus.getString("error.form.object.not.found"));
  }
}


/**
* generates an md5 hash of a javascript object
*/
Lazarus.generateHash = function(obj){
  return Lazarus.md5(Lazarus.JSON.encode(obj));
}

/**
* return the current unix timestamp
*/
Lazarus.timestamp = function(asFloat){
  var s = new Date().getTime() / 1000;
  return asFloat ? s : Math.floor(s);
}

/**
* return text usable by a menuitem (XUL Label)
*/
Lazarus.getMenuItemText = function(text){
  
		//strip any html found in the text
		text = Lazarus.trim(Lazarus.cleanText(text));
		
  //labels only handle a single line of text
  text = text.split(/\n/, 2)[0];
  //and we dont want it to be too long
  if (text.length > 48){
    text = text.substr(0, 48) +"...";
  }
		return Lazarus.trim(text);
}


/**
* ask the user for their Lazarus password
*/
Lazarus.showEnterPasswordDialog = function(){

  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  
  //keep asking until they hit cancel
  while(true){
    var password = {value: ""};
    var check = {value: false};
    //if a user has a master password set, then allow the lazarus password to be saved in the SSD
    var checkText = Lazarus.isMasterPasswordSet() ? Lazarus.getString('password.dialog.checkbox.label') : null;
    //
    if (prompts.promptPassword(null, Lazarus.getString("password.dialog.title"), Lazarus.getString("password.dialog.label"), password, checkText, check)){
      if (Lazarus.loadPrivateKey(password.value)){
        if (check.value){
          Lazarus.savePassword(password.value);
        }
        return true;
      }
    }
    else {
      break;
    }
  }
  
  return false;
}


Lazarus.savePassword = function(password){
  //remove the existing password first.
  Lazarus.removePassword();
  var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
  var loginInfo = new nsLoginInfo(Lazarus.LOGIN_HOSTNAME, null, Lazarus.LOGIN_REALM, Lazarus.LOGIN_USERNAME, password, '', '');
  var nsLoginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
  nsLoginManager.addLogin(loginInfo);
}


Lazarus.removePassword = function(){
  
  // Get Login Manager 
  var nsLoginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
  // Find users for this extension 
  var logins = nsLoginManager.findLogins({}, Lazarus.LOGIN_HOSTNAME, null, Lazarus.LOGIN_REALM);
  for (var i = 0; i < logins.length; i++) {
    if (logins[i].username == Lazarus.LOGIN_USERNAME){
      nsLoginManager.removeLogin(logins[i]);
    }
  }
}

/**
* load the password from the loginManager
*/
Lazarus.loadPassword = function(){
  
  if (Lazarus.isMasterPasswordSet() && !Lazarus.isMasterPasswordRequired()){
    // Get Login Manager 
    var nsLoginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);

    // Find users for the given parameters
    var logins = nsLoginManager.findLogins({}, Lazarus.LOGIN_HOSTNAME, null, Lazarus.LOGIN_REALM);
    
    // Find user from returned array of nsILoginInfo objects
    for (var i = 0; i < logins.length; i++) {
      if (logins[i].username == Lazarus.LOGIN_USERNAME){
        return logins[i].password;
      }
    }
  }
  //we default to an empty password
  return '';
}

Lazarus.logout = function(){
  Lazarus.unloadPrivateKey();
  Lazarus.refreshIcon();
}

/**
* generate a label for saved form menuitem
*/
Lazarus.generateSavedFormLabel = function(savedForm, time){
  var label = '';
  
  //template should ALWAYS use their template name as a label
  if (savedForm["savetype"] == Lazarus.FORM_TYPE_TEMPLATE){
    label = savedForm["formname"];
  }
  //use summary 
  else if (Lazarus.getExtPref("showFormTextInSubMenu") && Lazarus.canDecrypt()){
    label = Lazarus.getMenuItemText(Lazarus.decrypt(savedForm["formtext"])) || ("["+ Lazarus.getString("untitled") +"]");
  }
		//use timestamps if we are unable to decrypt the forms
  else {
    time = time || Lazarus.timestamp();
    label = Lazarus.getTimeString(time - savedForm["created"]);
  }
  
  //mark autosaved forms so users can easily tell the difference.
  switch(savedForm["savetype"]){
    case Lazarus.FORM_TYPE_AUTOSAVE:
    case Lazarus.FORM_TYPE_STALE_AUTOSAVE:
      label += " "+ Lazarus.getString("menuitem.label.append.autosave");
      break;
    
    case Lazarus.FORM_TYPE_TEMPLATE:
      label += " "+ Lazarus.getString("menuitem.label.append.template");
      break;
      
    default:
      label += " "+ Lazarus.getString("menuitem.label.append.normal");
      break;
  }
  
  return label;
}

/**
* generate a tooltip for saved form menuitem
*/
Lazarus.generateSavedFormTooltip = function(savedForm, /**/time){
  
  time = time || Lazarus.timestamp();
  
  var tooltip = '';
  
  //show time sting as tooltip
  if (Lazarus.getExtPref("showFormTextInSubMenu")){
    
    tooltip = Lazarus.getTimeString(time - savedForm["created"]);
  }
  //show date and time of save
  else {
    var date = new Date(savedForm["created"] * 1000);
    tooltip = Lazarus.formatDate(date);
  }
  
  //mark autosaved forms so users can easily tell the difference.
  switch(savedForm["savetype"]){
    case Lazarus.FORM_TYPE_AUTOSAVE:
    case Lazarus.FORM_TYPE_STALE_AUTOSAVE:
      tooltip += " "+ Lazarus.getString("menuitem.tooltip.append.autosave");
      break;
    
    case Lazarus.FORM_TYPE_TEMPLATE:
      tooltip += " "+ Lazarus.getString("menuitem.tooltip.append.template");
      break;
      
    default:
      tooltip += " "+ Lazarus.getString("menuitem.tooltip.append.normal");
      break;
      //do nothing
  }
  
  return tooltip;
}

/**
* builds the list of available restore point into the submenu
*/
Lazarus.buildSubMenu = function(form){

  
  var menu = Lazarus.$("lazarus-restoreform-submenu-menupopup");
  //remove all the current submenu items
  for (var i=menu.childNodes.length-1; i>=0; i--){
    var node = menu.childNodes[i];
    if (node.getAttribute("lazarus-dynamic-submenu")){
      menu.removeChild(node);
    }
  }
  
  var time = Lazarus.timestamp();
  var separator = Lazarus.$("lazarus-submenu-separator");
  //now build the new ones
  var lastSaveType = -1;
  var savedForms = Lazarus.getFormInfo(form, "id, formid, created, savetype, forminfohash, formtext, formname, forminfo");
  var info = Lazarus.formInfo(form);
  var infoHash = Lazarus.generateHash(info.fields);
  
  for (var i=0; i<savedForms.length; i++){
    var savedForm = savedForms[i];
    var menuitem = document.createElement("menuitem");
    
    //generate text for the label
    //menuitems can only handle a single line of text, and we don't want it to be too long
    var label = Lazarus.generateSavedFormLabel(savedForm, time);
    var tooltip = Lazarus.generateSavedFormTooltip(savedForm, time);
    
    menuitem.setAttribute("label", label);
    //menuitem.setAttribute('tooltiptext', tooltip);
    menuitem.setAttribute('oncommand', "Lazarus.onRestoreFormMenuItem(this)");
    menuitem.setAttribute('lazarus-forms-id', savedForm["id"]);
    menuitem.setAttribute('lazarus-dynamic-submenu', "true");
          
    //disable the menu item if the form is identical
    if (savedForm["forminfohash"] == infoHash){
      menuitem.setAttribute('tooltiptext', Lazarus.getString("form.is.equal"));
      menuitem.setAttribute('disabled', "true");
    }
    else {
      menuitem.setAttribute('tooltiptext', tooltip);
      menuitem.setAttribute('disabled', "");
    }
    
    //add separators between templates, normal saves, and autosaves
    if (lastSaveType != -1 && lastSaveType !== savedForm["savetype"] && savedForm["savetype"] != Lazarus.FORM_TYPE_STALE_AUTOSAVE){
      var newSeparator = document.createElement("menuseparator");
      newSeparator.setAttribute('lazarus-dynamic-submenu', "true");
      menu.insertBefore(newSeparator, separator);
    }
    lastSaveType = savedForm["savetype"];
    menu.insertBefore(menuitem, separator);
  }
}


/**
* return the period (in seconds) that forms should be saved for
*/
Lazarus.getExpiryTime = function(){

  if (Lazarus.getExtPref("expireSavedForms")){
    return (Lazarus.getExtPref("expireSavedFormsInterval") * Lazarus.getExtPref("expireSavedFormsUnit") * 60);
  }
  else {
    return 0;
  }
}

/**
* retrieves a list of details about a form from the database.
*/
Lazarus.getFormInfo = function(form, fields){
  var formId = Lazarus.getFormId(form);
  
  var expires = Lazarus.getExpiryTime();
  var cutoffTime = (expires > 0) ? (Lazarus.timestamp() - expires) : 0;
  
  fields = fields || "*";
  //we need to get ALL the templates for this form first
  var forms = [];
  forms = forms.concat(Lazarus.db.rs("SELECT "+ fields +" FROM forms WHERE formid = ?1 AND created >= ?2 AND savetype = "+ Lazarus.FORM_TYPE_TEMPLATE +" ORDER BY savetype DESC, created DESC", formId, cutoffTime));
  //and then the autosaves
  var maxAutoSaves = Lazarus.getExtPref("maxAutosavesPerForm", 3);
  forms = forms.concat(Lazarus.db.rs("SELECT "+ fields +" FROM forms WHERE formid = ?1 AND created >= ?2 AND savetype IN ("+ Lazarus.FORM_TYPE_AUTOSAVE +","+ Lazarus.FORM_TYPE_STALE_AUTOSAVE +") ORDER BY created DESC LIMIT ?3", formId, cutoffTime, maxAutoSaves));
  //and then add normal saved forms
  var maxForms = Lazarus.getExtPref("maxSavesPerForm", 10);
  forms = forms.concat(Lazarus.db.rs("SELECT "+ fields +" FROM forms WHERE formid = ?1 AND created >= ?2 AND savetype = "+ Lazarus.FORM_TYPE_NORMAL +" ORDER BY created DESC LIMIT ?3", formId, cutoffTime, maxForms));
  return forms;
}


Lazarus.replaceCreditCardNumbers = function(val){
	var regexCreditCardNumber = /\b((\d[ -]*){13,16})\b/g
	
	if (typeof val == "string"){
		val = val.replace(regexCreditCardNumber, function(m){
			return m.replace(/\d/g, "0");
		});
	}
	return val;
}


/**
* return a fieldInfo object filled with information about the given field
*/
Lazarus.fieldInfo = function(ele){

  var getPassword = Lazarus.getExtPref("savePasswordFields");
  var getHidden = Lazarus.getExtPref("saveHiddenFields");
  
  var info = {};
  info.name = ele.getAttribute("name");
  info.type = Lazarus.getElementType(ele);
  info.value = Lazarus.getElementValue(ele);
  if (info.type == "password" && !getPassword){
    info.value = null;
  }
  if (info.type == "hidden" && !getHidden){
    info.value = null;
  }
	if (Lazarus.getExtPref("replaceCreditCardNumbers")){
		info.value = Lazarus.replaceCreditCardNumbers(info.value);
	}
	
  
  switch (info.type){
    case "text":
    case "textarea":
    case "file":
    case "password":
    case "iframe":
      if (info.value && Lazarus.trim(info.value)){
        info.text = Lazarus.trim(info.value);
      }
      break;
    
    default:
  }
  
  return info;
}

/**
* clean HTML tags and entities from an html string
*/
Lazarus.cleanText = function(text){
  return text.replace(/<[^>]*>/g, ' ').replace(/&\w+;?/g, ' ').replace(/ +/g, ' ');
}

/**
* return a formInfo object filled with details about a form
*/
Lazarus.formInfo = function(form){

  var info = {};
  info.version = Lazarus.FORM_INFO_VERSION;
  info.formid = Lazarus.getFormId(form);
  info.action = Lazarus.getUrlPage(form.action || form.ownerDocument.URL);
  info.origURL = form.ownerDocument.URL;
  info.domain = Lazarus.getDomainFromElement(form);
  info.method = (form.method && form.method.toLowerCase()) == "post" ? "post" : "get";
  info.enctype = form.enctype ? form.enctype.toLowerCase() : '';
  info.fields = {};
  info.formtext = [];
  info.textLen = 0;
  for (var i=0; i<form.elements.length; i++){
    var ele = form.elements[i];
    var name = ele.getAttribute("name");
    if (name){
      switch (Lazarus.getElementType(ele)){
        case "text":
        case "textarea":
        case "file":
        case "radio":
        case "checkbox":
        case "select":
        case "password":
        case "hidden": 
          var fieldInfo = Lazarus.fieldInfo(ele);
          info.fields[name] = info.fields[name] || [];
          info.fields[name].push(fieldInfo);
          
          if (fieldInfo.text){
            info.formtext.push(fieldInfo.text);
            info.textLen += fieldInfo.text.length;
          }
          break;
          
        default:
          //ignore all other types
      }
    }
    //support for ajax textareas
    else if (form.isTextarea && Lazarus.getElementType(ele) == "textarea"){
      var fieldInfo = Lazarus.fieldInfo(ele);
      info.isTextarea = true;
      info.fields["textarea"] = [fieldInfo];
      if (fieldInfo.text){
        info.formtext.push(fieldInfo.text);
        info.textLen += fieldInfo.text.length;
      }
    }
    //support for ajax textareas
    else if (form.isIframe && Lazarus.getElementType(ele) == "iframe"){
      var fieldInfo = Lazarus.fieldInfo(ele);
      info.isIframe = true;
      info.fields["iframe"] = [fieldInfo];
      if (fieldInfo.text){
        info.formtext.push(fieldInfo.text);
        info.textLen += fieldInfo.text.length;
      }
    }
  }
  //we need to add any WYSIWYG iframes into the form as well
  var iframes = Lazarus.getEditableIframes(form);
  if (iframes.length > 0){
    info.fields[Lazarus.IFRAME_NAME] = [];
    info.isIframe = true;
    for (var i=0; i<iframes.length; i++){
      var name = Lazarus.IFRAME_NAME;
      var fieldInfo = Lazarus.fieldInfo(iframes[i]);
      
      info.fields[name] = info.fields[name] || [];
      info.fields[name].push(fieldInfo);
      
      if (fieldInfo.text){
        info.formtext.push(fieldInfo.text);
        info.textLen += fieldInfo.text.length;
      }
    }
  }
		
		info.formtext = Lazarus.trim(info.formtext.join("\n\n"));
  
  return info;
}


/**
* return an array of editable iframes found within the given node
*/
Lazarus.getEditableIframes = function(ele){
  var editableIframes = [];
  if (ele && ele.getElementsByTagName){
    var iframes = ele.getElementsByTagName('iframe');
    
    for (var i=0; i<iframes.length; i++){
      if (Lazarus.isEditableDoc(iframes[i].contentWindow.document)){
        editableIframes.push(iframes[i]);
      }
      //better get iframes within the iframes as well
      if (iframes[i].contentWindow.document.body){
        editableIframes = editableIframes.concat(Lazarus.getEditableIframes(iframes[i].contentWindow.document.body));
      }
    }
  }
  return editableIframes;
}

/**
* return TRUE if the given document is in edit mode
*/
Lazarus.isEditableDoc = function(doc){
  return (doc && (doc.designMode == "on" || (doc.body && doc.body.contentEditable === "true")));
}

/**
* return the base domain (wikipedia.org) given a full domain (en.wikipedia.org)
*/
Lazarus.getBaseDomain = function(domain){

  //if domain is an ip address return that 
  var regexIp = /\d+\.\d+\.\d+\.\d+$/
  var m = domain.match(regexIp);
  if (m){return m[0]}

  //known top level domains (TLDs) including country specific ones
  
  //http://en.wikipedia.org/wiki/Country_code_top-level_domain
  //all domains *should* either end in a 2 letter tld (google.co.nz, google.com.au) or none (google.com) for american sites
  //that should be preceeded by the generic tld
  //and then the basedomain
  var regex = /[^\.]+\.[^\.]+(\.\w{2})?$/;
  var m = domain.match(regex);
  //if we cant figure it out then return the whole domain
  return m ? m[0] : domain;    
}



/**
* restores a form to the given state
*/
Lazarus.restoreForm = function(form, formInfo){

  //attempt to restore the saved fields for this form
  var restorePassword = Lazarus.getExtPref("savePasswordFields");   
  var restoreHidden = Lazarus.getExtPref("saveHiddenFields"); 
  
  //try and recover as many fields as possible for this form.
  var iRestored = 0;
  var iNamedElements = 0;
  var formFields = {};
  for (var i=0; i<form.elements.length; i++){
    var ele = form.elements[i];
    var name = ele.getAttribute("name");
    var eleType = Lazarus.getElementType(ele);
    var eleValue = Lazarus.getElementValue(ele);
    
    if (name){
      switch (eleType){
        case "text":
        case "textarea":
        case "file":
        case "radio":
        case "checkbox":
        case "select":
        case "password":
        case "hidden":
          //try to restore this element
          iNamedElements++;
          //do we have an match for this element in our saved form 
          if (formInfo.fields[name]){
            for (var j=0; j<formInfo.fields[name].length; j++){
              var info = formInfo.fields[name][j];
              if (!info.restored && info.type == eleType){
                switch (eleType){
                  case "text":
                  case "textarea":
                  case "file":
                  case "select":
                    Lazarus.setElementValue(ele, info.value);
                    iRestored++;
                    break;
                    
                  case "radio":
                  case "checkbox":
                    if (info.value && (eleValue.valueAttr == info.value.valueAttr)){
                      Lazarus.setElementValue(ele, info.value.checked);
                      iRestored++;
                    }
                    break;
                    
                  case "password":
                    if (restorePassword){
                      Lazarus.setElementValue(ele, info.value);
                    }
                    iRestored++;
                    break;
                    
                  case "hidden":
                    if (restoreHidden){
                      Lazarus.setElementValue(ele, info.value);
                    }
                    iRestored++;
                    break;
                  
                  default:
                    //no need to restore 
                    iRestored++;
                }
              }
            }
          }
        default:
          //ignore other types of elements
      }
    }
    else if (form.isTextarea && Lazarus.isTextarea(ele)){
      var info = formInfo.fields["textarea"][0];
      Lazarus.setElementValue(ele, info.value);
      iRestored++;
      iNamedElements++;
    }
    else if (form.isIframe && ele.tagName == "iframe"){
      var info = formInfo.fields["iframe"][0];
      Lazarus.setElementValue(ele, info.value);
      iRestored++;
      iNamedElements++;
    }
  }
  //try and restore any WYSIWYG editors as well
  var iframes = Lazarus.getEditableIframes(form);
  if (iframes && formInfo.fields[Lazarus.IFRAME_NAME]){
    for (var i=0; i<iframes.length; i++){
      var info = formInfo.fields[Lazarus.IFRAME_NAME][i];
      if (info){
        Lazarus.setElementValue(iframes[i], info.value);
      }
    }
  }
  
  
  //check for errors
  if (iRestored == 0){
    alert(Lazarus.getString("error.restore.none"));
    return false;
  }
  //tell them if we couldn't restore some fields
  else if (iRestored < iNamedElements){
    //only show the partial restore message if the form is not an old style form
    if (formInfo.version && formInfo.version >= 1){
      alert(Lazarus.getString("error.restore.partial"));
    }
    return (iRestored / iNamedElements);
  }
  else {
    return true;
  }
}

/**
* handle the onselectmenuitem event
*/
Lazarus.onRestoreFormMenuItem = function(menuitem){

  if (!Lazarus.canDecrypt()){
    Lazarus.debug("Unable to restore form, password required");
    Lazarus.showNotificationBox("password-required"); 
    return;
  }
  
  var id = parseInt(menuitem.getAttribute("lazarus-forms-id"));
  
  Lazarus.debug("Attempting to restore form "+ id);
  var form = Lazarus.findFormFromElement(gContextMenu.target, "form");
  if (form){
    var row = Lazarus.db.getRow("SELECT * FROM forms WHERE id = ?1", id);
    if (row){
      var formInfo;
      try {
        formInfo = Lazarus.JSON.decode(Lazarus.decrypt(row["forminfo"]));
      }
      catch(e){
        Lazarus.error(e);
      }
      
      if (formInfo){
        //if we fully restore a form, then show the "donate" popup
        if (Lazarus.restoreForm(form, formInfo) === true){
          Lazarus.incPref("extensions.lazarus.restoreFormCount");
          if ((formInfo.textLen > Lazarus.MIN_TEXT_NEEDED_TO_SHOW_NOTIFICATION) && Lazarus.getPref("extensions.lazarus.showDonateNotification") && Lazarus.getPref("extensions.lazarus.restoreFormCount", 0) > 3){
            var msgId = Math.floor(Math.random() *  4);
            Lazarus.showNotificationBox("form-restored", Lazarus.getFormRestoredNotificationText(formInfo.textLen, msgId), "msgid-"+ msgId);            
          }
        }
      }
      else {
        alert(Lazarus.getString("error.form.db.corrupt"));
      }
    }
    else {
      alert(Lazarus.getString("error.form.not.found"));
    }
  }
  else {
    alert(Lazarus.getString("error.form.object.not.found"));
  }
}

/**
* return TRUE if form is a form we should save
*/
Lazarus.shouldSaveForm = function(form){
  //only save forms on file/http/https sites
  var doc = form.ownerDocument;
  if (doc && doc instanceof HTMLDocument && doc.URL && /^(file|http|https):/.test(doc.URL) && !Lazarus.isPageDisabled(doc.URL) && !Lazarus.isDisabledByPrivateBrowsing()){
		return (Lazarus.isSearchForm(form)) ? Lazarus.getPref("extensions.lazarus.saveSearchForms") : true;
  }
  else {
    return false;
  }
}

/**
* return TRUE if we should be saving this info
*/
Lazarus.shouldSaveEditorInfo = function(info){
		if (Lazarus.isPageDisabled(info.url)){
			return false;
		}
		else if (Lazarus.isDisabledByPrivateBrowsing()){
			return false;
		}
		else {
			return true;
		}
}



Lazarus.disabledDomains = null;

Lazarus.isPageDisabled = function(url){
  if (!url && content.document && content.document.URL){
    url = content.document.URL;
  }
  if (url){
    var domainId = Lazarus.urlToDomainId(url);
    if (domainId){
      var domains = Lazarus.getDisabledDomains();      
      return (typeof domains[domainId] !== "undefined") ? domains[domainId] : false;
    }
  }
  return false;
}

/**
* return TRUE if lazarus can save forms from this site
* return FALSE for non-valid sites (eg about:config, chrome://... etc..)
*/
Lazarus.isValidSite = function(url){
  //default to the current documents url
  if (!url && content.document && content.document.URL){
    url = content.document.URL;
  }
  return (url && Lazarus.urlToDomainId(url)) ? true : false;
}

Lazarus.getDisabledDomains = function(){
  var domainlist = Lazarus.getPref('extensions.lazarus.domainBlacklist', '');
  
  if (!Lazarus.disabledDomains || Lazarus.disabledDomains['__origList__'] != domainlist){
    //rebuild the list
    Lazarus.disabledDomains = {
      '__origList__': domainlist
    }
    var domains = domainlist.split(/\s*,\s*/g);
    for (var i=0; i<domains.length; i++){
      Lazarus.disabledDomains[domains[i]] = true;
    }  
  }
  return Lazarus.disabledDomains;
}

Lazarus.saveDisabledDomains = function(domainsTable){
  //convert the table back into an array and save it.
  var domains = [];
  for(var domain in domainsTable){
    if (domainsTable[domain] && /^\w+:/.test(domain)){
      domains.push(domain);
    }
  }

  return Lazarus.setPref('extensions.lazarus.domainBlacklist', domains.join(','));
}


Lazarus.enableForCurrentDomain = function(){
  //fetch the current domain, and disable Lazarus
  if (content.document && content.document.URL){
    var domainId = Lazarus.urlToDomainId(content.document.URL);
    //and add to disabled domains list.
    
    var domains = Lazarus.getDisabledDomains();
    if (!domains[domainId]){
      domains[domainId] = true;
      Lazarus.saveDisabledDomains(domains);
      Lazarus.debug('Domain disabled ['+ domainId +']');
    }
    else {
      //should already be disabled!
      Lazarus.warning('Domain is already disabled ['+ domainId +']');
    }
     
    //and refresh the statusbar icon
    Lazarus.refreshIcon();
  }
  else {
    alert(Lazarus.getString("error.no.document"));
  }
}


/**
* enables or disabled on the current website
*/
Lazarus.toggleCurrentDomain = function(enable){
  //fetch the current domain, and disable Lazarus
  if (content.document && content.document.URL){
    var domains = Lazarus.getDisabledDomains();
    var domainId = Lazarus.urlToDomainId(content.document.URL);
    
    if (domainId){
      //add/remove from disabled domains list
      domains[domainId] = enable ? false : true;
      Lazarus.saveDisabledDomains(domains);
      Lazarus.debug('Domain ['+ domainId +'] enabled = '+ enable);
      //and refresh the statusbar icon
      Lazarus.refreshIcon();
    }
    else {
      Lazarus.error("Failed to extract domainId from URL ["+ content.document.URL +"]");
    }
  }
  else {
    alert(Lazarus.getString("error.no.document"));
  }
}


Lazarus.onStatusbarMenuShowing = function(popupmenu){
  var validSite = Lazarus.isValidSite();
  var siteDisabled = Lazarus.isPageDisabled();
  var isPrivate = Lazarus.isDisabledByPrivateBrowsing();
  
  Lazarus.$('lazarus-statusbar-menuitem-toggledomain-separator').hidden = !(validSite && !isPrivate);
  Lazarus.$('lazarus-statusbar-menuitem-enablefordomain').hidden = !(validSite && siteDisabled && !isPrivate);
  Lazarus.$('lazarus-statusbar-menuitem-disablefordomain').hidden = !(validSite && !siteDisabled && !isPrivate);
  Lazarus.$('lazarus-statusbar-menuitem-logout').hidden = !(Lazarus.Crypto.isPasswordEntered);
}

/**
* return a website identifier
* http://google.com is different from https://google.com
*/
Lazarus.urlToDomainId = function(url){
  var uri = Lazarus.urlToURI(url);
  return (uri && uri.scheme && uri.host && (/^(http|https|file)$/.test(uri.scheme))) ? (uri.scheme +":"+ ((uri.port > -1 && uri.port != 80) ? uri.port : '') +'//'+ Lazarus.getBaseDomain(uri.host) +'/') : '';   
}


/**
* return TRUE if form appears to be a search form
*/
Lazarus.isSearchForm = function(form){
  //search forms are forms that have exactly one textbox, and may contain a number of other non-text fields
	var MAX_TEXT_FIELDS = 1;
	var MAX_NON_TEXT_FIELDS = 5;
	
	var iTextFields = 0;
	var iNonTextFields = 0;
	
	for (var i=0; i<form.elements.length; i++){
	  var ele = form.elements[i];
		switch(Lazarus.getElementType(ele)){
		  case "text":
				iTextFields++;
				break;
			
			case "radio":
			case "checkbox":
			case "select":
				iNonTextFields++;
				break;
				
			case "file":	
			case "password":
			case "textarea":
				return false;
						
			case "hidden":
			case "submit":
			case "reset":
			case "button":
			case "image":
			default:
				//ignore all other types
		}
	}
  //NOTE: we MUST have a single text field
	return  (iTextFields == MAX_TEXT_FIELDS && iNonTextFields <= MAX_NON_TEXT_FIELDS);
}


/**
* check a submit event, and saves form details if the event is from a valid form
*/
Lazarus.onFormSubmit = function(evt){
  var form = Lazarus.findFormFromElement(evt.target);
  //is the form on an html document?
  if (form && form.ownerDocument instanceof HTMLDocument){
    Lazarus.stopAutoSaveTimer();
    Lazarus.saveForm(form, Lazarus.FORM_TYPE_NORMAL);
  }
}

/**
* return "post" of "get" depending on the given forms method
*/
Lazarus.getFormMethod = function(form){
  var method = form.getAttribute("method");
  return (method && method.toLowerCase() == "post") ? "post" : "get";
}

/**
* autosave a form if we change anything about it.
*/
Lazarus.onFormChange = function(evt){
  var form = Lazarus.findFormFromElement(evt.target);
  
  if (form && form.ownerDocument instanceof HTMLDocument){
    //I think we should chuck a timer in here, because we might end up saving a lot.
    Lazarus.restartAutoSaveTimer(form);
  }
}

/**
* check a reset event, and saves form details if the event is from a valid form
*/
Lazarus.onFormReset = function(evt){
  var form = Lazarus.findFormFromElement(evt.target);
  //is the form on an html document?
  if (form && form.ownerDocument instanceof HTMLDocument){
    Lazarus.stopAutoSaveTimer();
    Lazarus.saveForm(form, Lazarus.FORM_TYPE_AUTOSAVE);
  }
}

/**
* create a searchable index of hashed words
*/
Lazarus.indexFormText = function(id, text, url){
		//and update the full text index,
		if (!Lazarus.getPref('extensions.lazarus.disableSearch')){
				//we're going to add domain info into this as well so a user can search for domain fragments too
				var hashedText = Lazarus.hashText(text);
				
				//extract the domain from the url
				var domain = Lazarus.urlToURI(url).host;
				
				hashedText += ' '+ Lazarus.hashText(domain.replace(/\./g, ' '));
				
				Lazarus.db.exe("DELETE FROM forms_fulltext WHERE docid = ?1", id);
				Lazarus.db.exe("INSERT INTO forms_fulltext (docid, hashed_text) VALUES (?1, ?2)", id, hashedText);
		}
}

/**
* save all the named elements in a form to the permanent store
*/
Lazarus.saveForm = function(form, formType, templateName, autofill){
  
  autofill = autofill ? 1 : 0;
  
  if (Lazarus.shouldSaveForm(form)){
  
    templateName = templateName || '';
    
    var info = Lazarus.formInfo(form);
    
    //dont save empty forms?
    //No. what about forms with lots of radio buttons (eg multichoice surveys)  
    var infoJSON = Lazarus.JSON.encode(info)
    var encryptedInfo = Lazarus.encrypt(infoJSON);
    var encryptedText = Lazarus.encrypt(Lazarus.getMenuItemText(info.formtext));
    var encryptedFormURL = Lazarus.encrypt(Lazarus.getFormURL(form));
    
    var infoHash = Lazarus.generateHash(info.fields);
    
    //each form type needs to be saved differently
    switch(formType){
      case Lazarus.FORM_TYPE_AUTOSAVE:
      case Lazarus.FORM_TYPE_STALE_AUTOSAVE: 
      
        var savedForm = Lazarus.db.getRow("SELECT id, savetype FROM forms WHERE formid = ?1 AND forminfohash = ?2 AND savetype IN ("+ Lazarus.FORM_TYPE_AUTOSAVE +","+ Lazarus.FORM_TYPE_STALE_AUTOSAVE +") LIMIT 1", info.formid, infoHash);
    
        //add or update the current autosave
        if (!savedForm){
          Lazarus.Event.fire("saving-form");
          
          var lastAutoSaveId = Lazarus.db.getInt("SELECT id FROM forms WHERE formid = ?1 AND savetype = "+ Lazarus.FORM_TYPE_AUTOSAVE +" ORDER BY created DESC LIMIT 1", info.formid);
          var lastAutoSave = (lastAutoSaveId && Lazarus.lastAutoSaveForm && Lazarus.lastAutoSaveForm["formid"] == info.formid) ? Lazarus.lastAutoSaveForm : null;
          var newId = 0;
										
          if (lastAutoSave && Lazarus.shouldCreateNewAutosave(info, lastAutoSave)){
            //if the saved form is smaller than the last saved form by a substantial amount,
            //create a new restore point.
            Lazarus.debug("Creating additional autosave point "+ info.formid);
            Lazarus.db.exe("INSERT INTO forms (formid, created, forminfo, formtext, forminfohash, formurl, text_length, savetype) \
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, "+ Lazarus.FORM_TYPE_AUTOSAVE +")", info.formid, Lazarus.timestamp(), encryptedInfo, encryptedText, infoHash, encryptedFormURL, info.textLen);
												newId = Lazarus.db.getInt("SELECT MAX(id) FROM forms");
          }
          else if (lastAutoSave){
            Lazarus.debug("Updating autosave form "+ info.formid);
            Lazarus.db.exe("UPDATE forms SET created = ?1, forminfo = ?2, formtext = ?3, forminfohash = ?4, formurl = ?5, text_length = ?6 \
              WHERE id = ?7", Lazarus.timestamp(), encryptedInfo, encryptedText, infoHash, encryptedFormURL, info.textLen, lastAutoSaveId);
												newId = lastAutoSaveId;
          }
          else {
            Lazarus.debug("Creating new autosave form "+ info.formid);
            Lazarus.db.exe("INSERT INTO forms (formid, created, forminfo, formtext, forminfohash, formurl, text_length, savetype) \
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, "+ Lazarus.FORM_TYPE_AUTOSAVE +")", info.formid, Lazarus.timestamp(), encryptedInfo, encryptedText, infoHash, encryptedFormURL, info.textLen);
												newId = Lazarus.db.getInt("SELECT MAX(id) FROM forms");
          }
										
										//update the full text search as well
										Lazarus.indexFormText(newId, info.formtext, info.origURL);
										
          //and save this forminfo as the last autosave point
          Lazarus.lastAutoSaveForm = info;
          Lazarus.Event.fire("form-saved");
        }
        else {
          Lazarus.debug("No need to autosave form, form already exists: "+ info.formid);
        }
        
        break;
      
      case Lazarus.FORM_TYPE_NORMAL: 
        
        Lazarus.Event.fire("saving-form");
        
        //delete all autosaves 
        Lazarus.removeForms(Lazarus.db.getColumn("SELECT id FROM forms WHERE formid = ?1 AND savetype IN ("+ Lazarus.FORM_TYPE_AUTOSAVE +","+ Lazarus.FORM_TYPE_STALE_AUTOSAVE +")", info.formid));
      
        //if this form already exists, delete it
        Lazarus.removeForms(Lazarus.db.getColumn("SELECT id FROM forms WHERE formid = ?1 AND forminfohash = ?2 AND savetype = "+ Lazarus.FORM_TYPE_NORMAL, info.formid, infoHash));
    
        //and save this form
        Lazarus.db.exe("INSERT INTO forms (formid, created, forminfo, formtext, forminfohash, formname, formurl, text_length, savetype, autofill) \
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)", 
          info.formid, Lazarus.timestamp(), encryptedInfo, encryptedText, infoHash, templateName, encryptedFormURL, info.textLen, formType);
        Lazarus.debug("form saved ["+ info.formid +"]");
								
								//update the full text search as well
								var newId = Lazarus.db.getInt("SELECT MAX(id) FROM forms");
								Lazarus.indexFormText(newId, info.formtext, info.origURL);
        Lazarus.Event.fire("form-saved");
        break;
      
      case Lazarus.FORM_TYPE_TEMPLATE: 
      
        Lazarus.Event.fire("saving-form");
        //if another template with the same name exists, delete it
								Lazarus.removeForms(Lazarus.db.getColumn("SELECT id FROM forms WHERE formname = ?1 AND savetype = "+ Lazarus.FORM_TYPE_TEMPLATE, templateName));
    
        //likewise we are not allowed to have more then one autofill for the same form.
        if (autofill){
          Lazarus.db.exe("UPDATE forms SET autofill = 0 WHERE formid = ?1", info.formid);
        }
        
        //and save this form 
        Lazarus.db.exe("INSERT INTO forms (formid, created, forminfo, formtext, forminfohash, formname, formurl, text_length, savetype, autofill) \
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)", 
          info.formid, Lazarus.timestamp(), encryptedInfo, encryptedText, infoHash, templateName, encryptedFormURL, info.textLen, formType, autofill);
        
								var newId = Lazarus.db.getInt("SELECT MAX(id) FROM forms");
								Lazarus.indexFormText(newId, info.formtext, info.origURL);
								Lazarus.debug("template saved ["+ info.formid +"]");
        Lazarus.Event.fire("form-saved");
        break;
          
      default:
        Lazarus.error(Error("Unknown form type ["+ row["formtype"] +"]"));
        
    }
    Lazarus.startCleanupTimer();
  }
  else {
    Lazarus.debug("Form not saved: invalid form");
  }
}


/**
* remove forms from the database
*/
Lazarus.removeForms = function(ids){
	if (!ids || (Lazarus.isArray(ids) && ids.length === 0)){
		return;
	}
	Lazarus.debug("removing forms", ids);

	if (!Lazarus.isArray(ids)){
		ids = [ids];
	}
	//make sure the ids are safe.
	for(var i=0; i<ids.length; i++){
		ids[i] = parseInt(ids[i]);
	} 
	Lazarus.db.exe("DELETE FROM forms WHERE id IN ("+ ids.join(",") +")");
	Lazarus.db.exe("DELETE FROM forms_fulltext WHERE docid IN ("+ ids.join(",") +")"); 
	
	Lazarus.debug(ids.length +" forms removed");
}


/**
* return the URL of the page this form is currently on, but leave any query info
*/
Lazarus.getFormURL = function(form){
  //we'll strip any anchor tags from the URL
  return form.ownerDocument.URL.replace(/#.*/, '');
}

/**
* 
* 
* 
*/
Lazarus.shouldCreateNewAutosave  = function(newForm, oldForm){

  //number of characters to ignore when calculating if the form has changed substantially
  var TEXT_DIFFERENCE = 32; //

  if (oldForm.formtext.length > (TEXT_DIFFERENCE * 2)){
    var str = oldForm.formtext.substr(0, oldForm.formtext.length - TEXT_DIFFERENCE);
    //if new form is a continuation of old form (ie the first (X - TEXT_DIFFERENCE) characters are still the same), 
    //then overwrite current autosave,
    //otherwise create a new autosave.
    return (newForm.formtext.indexOf(str) == -1);
  }
  //form contains little text, overwrite the current autosave
  else {
    return false;
  }   
}

/**
* automatically save the form the user is working on.
*/
Lazarus.autoSaveForm = function(){
  //does the form still exist?
  if (Lazarus.currAutoSaveForm && !Lazarus.isContextMenuShowing){
    Lazarus.saveForm(Lazarus.currAutoSaveForm, Lazarus.FORM_TYPE_AUTOSAVE);
  }
}

/**
* start the cleanup timer
*/
Lazarus.startCleanupTimer = function(){
  
  Lazarus.stopCleanupTimer();
  
  if (Lazarus.getExpiryTime()){  
    Lazarus.cleanupSavedFormsTimer = setInterval(Lazarus.cleanupSavedForms, 1000 * 60);
  }
}

/**
* stop the cleanup timer
*/
Lazarus.stopCleanupTimer = function(){
  if (Lazarus.cleanupSavedFormsTimer){
    clearInterval(Lazarus.cleanupSavedFormsTimer);
  }
}

/**
* remove old forms from the database
*/
Lazarus.cleanupSavedForms = function(){

  //dont cleanup any forms if a user might be trying to retore them
  if (Lazarus.isContextMenuShowing){return}
  
  var expires = Lazarus.getExpiryTime();

  if (expires > 0){
    //add a couple of minutes to the expiry time, so we don't accidentally 
    //remove a form whilst we are current restoring it.
    var cutoffTime = Lazarus.timestamp() - (expires + 120);
    var ids = Lazarus.db.getColumn("SELECT id FROM forms WHERE created < ?1 AND savetype != "+ Lazarus.FORM_TYPE_TEMPLATE, cutoffTime);
		
		Lazarus.db.exeAsync("DELETE FROM forms WHERE id IN ("+ ids.join(",") +")");
		Lazarus.db.exeAsync("DELETE FROM forms_fulltext WHERE docid IN ("+ ids.join(",") +")"); 
				
		var ids = Lazarus.db.getColumn("SELECT id FROM textdata WHERE created < ?1", cutoffTime);
    if (ids.length > 0){
      Lazarus.db.exeAsync("DELETE FROM textdata WHERE id IN ("+ ids.join(",") +")");
      Lazarus.db.exeAsync("DELETE FROM textdata_fulltext WHERE docid IN ("+ ids.join(",") +")"); 
    }
  }
  else {
    Lazarus.stopCleanupTimer();
  }
}

/**
* return an identifier for a url
*/
Lazarus.getUrlPage = function(url){
  var uri = Lazarus.urlToURI(url);
  if (uri){
    return uri.scheme +"://"+ uri.hostPort + uri.path.replace(/[\?#].*$/, '');
  }
  //for testing on file systems
  else if ((Lazarus.getExtPref("debugMode") >= 3) && url.match(/^file:\/\//i)){
    return "file://just/testing";
  }
  else {
    return null;
  }
}

/**
* return the user editable fields within a form.
*/
Lazarus.getEditableFields = function(form){
  var fields = [];
  var saveHidden = Lazarus.getExtPref("saveHiddenFields");
  var savePassword = Lazarus.getExtPref("savePasswordFields");
  
  for (var i=0; i<form.elements.length; i++){
    var ele = form.elements[i];
    //ignore fields with no name (they dont get submitted to the server)
    if (ele.getAttribute("name")){
      switch(Lazarus.getElementType(ele)){
        case "text":
        case "textarea":
        case "file":
        case "radio":
        case "checkbox":
        case "select":
          fields.push(ele);
          break;
        
        case "password":
          if (savePassword){
            fields.push(ele);
          }
          break;
          
        case "hidden":
          if (saveHidden){
            fields.push(ele);
          }
          break;
          
        //ignore buttons
        case "submit":
        case "reset":
        case "button":
        case "image":
        //and unknown elements
        default:
          //unknown element type
          break;
      }
    }
  }
  return fields;
}


/**
* return TRUE if element is a textarea
*/
Lazarus.isTextarea = function(ele){
  return (ele && ele.nodeName && ele.nodeName.toLowerCase() == "textarea");
}


/**
* return TRUE if element is an iframe
*/
Lazarus.isIframe = function(ele){
  return (ele && ele.nodeName && ele.nodeName.toLowerCase() == "iframe");
}

/**
* generate a formid for this form
*/
Lazarus.getFormId = function(form){ 

  //if this form is from the Lazarus Form Recovery page, then use the id specified in the form
  if (Lazarus.isDocRecoveryForm(form.ownerDocument)){
    return form.getAttribute("lazarus-form-id");
  }
  

  //forms with no "action" attribute default to sending data to the current page
  var action = form.action || form.ownerDocument.URL;
  var uri = Lazarus.urlToURI(action);
  
  var formId = (uri && uri.host) ? Lazarus.getBaseDomain(uri.host) : '';
  //debugging (on local file system)
  if (!formId && (Lazarus.getExtPref("debugMode") >= 3) && action.match(/^file:\/\//i)){
    formId = "file://just/testing";
  }
  
  //and point to the same place 
  if (formId){

    //support for ajax textareas
    if (form.isTextarea){
      formId += "<textarea>";      
    }
    //and iframes not contained within forms
    else if (form.isIframe){
      formId += "<iframe>";      
    }
    //#7: Not saving trac "comment" forms
    //sometimes forms will add additional hidden fields 
    
    //if the form has a name, formId , or class we'll add that as well.
    //no not class. If a form has an error the classname might be changed to highlight 
    //the error to the user 
    
    //we will generate an formId from the editable fields name property
    //only fields with a name property are submitted.
    else if (form.name || form.id){
      formId += form.name ? ("@"+ form.name) : "";
      //KLUDGE: gmails email form changes the id of the form every time you start a new email
      formId += form.id && (form.ownerDocument.domain.indexOf("google") == -1) ? ("#"+ form.id) : "";
    }
    //fall back to using an identifier generated form the elements within the page
    else {
      var names = [];
      for (var i=0; i<form.elements.length; i++){
        var ele = form.elements[i];
        var name = ele.getAttribute("name");
        if (name){
          switch(Lazarus.getElementType(ele)){
            case "text":
            case "textarea":
            case "file":
            case "radio":
            case "checkbox":
            case "select": 
              names.push(name.toLowerCase());
          }
        }
      }
      
      //sort and remove duplicate names
      names.sort();
      names = Lazarus.arrayUnique(names);
      
      formId += "["+ names.join(",") +"]";
    }
    
    //#48: including the domain within the formId constitutes a privacy risk.
    formId = Lazarus.md5(formId);
    return formId;
  }
  else {
    Lazarus.warning("Lazarus: Unable to convert url to uri ["+ action +"]");
    return '';
  }
}

/**
* return a new array containing members of the given array with no duplicates
*/
Lazarus.arrayUnique = function(arr){
  var newArr = [];
  for (var i=0; i<arr.length; i++){
    if (!Lazarus.inArray(arr[i], newArr)){
      newArr.push(arr[i]);
    }
  }
  return newArr;
}

/**
* return a user friendly string stating the elapsed time in seconds, minutes, hours or days
*/
Lazarus.getTimeString = function(sec){

  if (sec < 1){sec = 1}
  
  var units = {
    "day" : 60 * 60 * 24,
    "hour" : 60 * 60,
    "minute": 60,
    "second": 1
  }
  
  for(var unit in units){
    if (sec >= units[unit]){
      var numUnits = Math.floor(sec / units[unit]);
      if (numUnits == 1){
        return Lazarus.getString("elapsed."+ unit);
      }
      else {
        return Lazarus.getString("elapsed."+ unit +"s", numUnits);
      }
    }
  }
  //should never get here
  return Lazarus.getString("elapsed.second");
}

/**
* returns an elements value
*/
Lazarus.getElementValue = function(ele){
  switch(Lazarus.getElementType(ele)){
    //text fields
    case "text":
    case "password":
    case "textarea":
    case "file":
    case "hidden":
      return ele.value;
      
    case "radio":
    case "checkbox":
      return {
        "valueAttr": ele.value,
        "checked": ele.checked
      }
      
    //buttons
    case "submit":
    case "reset":
    case "button":
    case "image":
      return ele.value;
    
    case "select":
      //select boxes have the option to allow multiple selections
      var selected = [];
      if (ele.options){
        for (var i=0; i<ele.options.length; i++){
          if (ele.options[i].selected){
            selected.push(ele.options[i].value);
          }
        }
      }
      return selected;
    
    case "iframe":
      var doc = ele.contentWindow.document;
      return (doc && doc.body && doc.body.innerHTML) ? doc.body.innerHTML : '';
      
    default:
      //unknown element type
      return null;
  }
}

/**
* returns an elements value
*/
Lazarus.setElementValue = function(ele, value){
  switch(Lazarus.getElementType(ele)){
    //text fields
    case "text":
    case "password":
    case "textarea":
    case "file":
    case "hidden":
      ele.value = value;
      break;
      
    case "radio":
    case "checkbox":
      ele.checked = value;  
      break;
      
    //buttons
    case "submit":
    case "reset":
    case "button":
    case "image":
      ele.value = value;
      break;
    
    case "select":
      //select boxes have the option to allow multiple selections
      var selected = [];
      if (ele.options){
        //bugfix: RT: 101284
        //inArray is taking too long for large (10,000+) select boxes, so we'll convert the values array into 
        //a hash table instead
        //hmmm, the problem is not actually in the inArray function
        //but rather the line 
        //ele.options[i].selected = table[ele.options[i].value] ? true : false;
        // it appears that a lot goes on behind the scenes when a selectbox option
        //is set, even if the value doesn't change.        
        var table = Lazarus.arrayToHashTable(value);
        for (var i=0; i<ele.options.length; i++){
          var selectOption = table[ele.options[i].value] ? true : false;
          if (ele.options[i].selected != selectOption){
            ele.options[i].selected = selectOption;
          }
        }
      }
      break;
      
    case "iframe":
      var doc = ele.contentWindow.document;
      if (doc && doc.body){
        doc.body.innerHTML = value;
      }      
      break;
      
    default:
      //unknown element type
      break;
  }
}


/**
* return a string explaining the type of a form element
* differentiates between different input types.
*/
Lazarus.getElementType = function(ele){
  if (ele.nodeName.toLowerCase() == "input"){
    return ele.type.toLowerCase();
  }
  else {
    return ele.nodeName.toLowerCase();
  }
}

/**
* return a fake form object
*/
Lazarus.createFakeForm = function(ele, type){
  return {
    ownerDocument: ele.ownerDocument,
    elements: [ele],
    action: Lazarus.urlToDomainId(ele.ownerDocument.URL) || '',
    isTextarea: (type == "textarea"),
    isIframe: (type == "iframe"),
    isFakeForm: true
  };
}

Lazarus.getParentIframe = function(ele){
  var win = ele.ownerDocument.defaultView.frameElement;
  var win = doc && doc.defaultView;
  return win.frameElement;
}   


/**
* return the first content editable iframe or textarea from a given element
*/
Lazarus.findEditorFromElement = function(ele){

  while(ele){
    if (Lazarus.isTextarea(ele)){
      return ele;
    }
    else if (Lazarus.isEditableDoc(ele.ownerDocument) && ele.ownerDocument.defaultView.frameElement){
      return ele.ownerDocument.defaultView.frameElement; 
    }
    else {
      ele = ele.parentNode;
    }
  }
}

/**
* finds a parent form from this element 
*/
Lazarus.findFormFromElement = function(ele){
  
  var iframe = false;
  
  while(ele){
    if (ele.nodeName && ele.nodeName.toLowerCase() == "form"){
      return ele;
    }
    else if (ele.form && ele.form.nodeName.toLowerCase() == "form"){
      return ele.form;
    }
    //add support for AJAX textareas that are not contained within a form.
    else if (Lazarus.isTextarea(ele)){
      //we're going to build a fake form here, that contains the , so the rest of the code can handle 
      return Lazarus.createFakeForm(ele, "textarea");
    }
    else if (Lazarus.isEditableDoc(ele.ownerDocument)){
      iframe = ele.ownerDocument.defaultView.frameElement;
      //move to parent iframe
      //Hmmm. Problem exists when the editable iframe is contained within another iframe (eg FCKEditor)
      //we'll need to iterate up through all the frames. But we also need to check if this frame contains the form element
      ele = iframe;
    }
    else if (ele.parentNode && ele.parentNode.tagName){
      ele = ele.parentNode;
    }
    //an iframe has been detected, but no form was found in this iframe
    //so move up to the containing frame (if any)
    else if (iframe){
      ele = ele.ownerDocument.defaultView.frameElement;
    }
    else {
      return null;
    }
  }
  
  if (iframe){
    //we have an editable iframe that is NOT contained within a form!
    //probably some type of AJAX form
    //we'll need to build a fake form and the iframe in there
    return Lazarus.createFakeForm(iframe, "iframe");
  }
  
  return null;
}
/**
* finds the first node of type nodeName from ele up the dom tree
*/
Lazarus.findParent = function(ele, nodeName){
  nodeName = nodeName.toLowerCase();
  while(ele){
    if (ele.nodeName && ele.nodeName.toLowerCase() == nodeName){
      return ele;
    }
    else {
      ele = ele.parentNode;
    }
  }
  return null;
}

/**
* 
*/
Lazarus.onStatusbarImageClick = function(evt){
  
  var state = Lazarus.getState()
  
  if (state == Lazarus.STATE_DISABLED){
    evt.preventDefault();
    Lazarus.openGenerateKeysDialog();
    if (Lazarus.reloadKeys()){
      Lazarus.enable();
    }
    return false;
  }
  
  //only on left click
  if (evt.which == 1){
    switch (state){
      case Lazarus.STATE_ENABLED:
        Lazarus.openStatusbarMenu(evt);
        return;
        
      case Lazarus.STATE_PASSWORD_REQUIRED:
        Lazarus.showEnterPasswordDialog();
        return 
      
      case Lazarus.STATE_PRIVATE_BROWSING:
        alert(Lazarus.getString('private.browsing.mode'));
        return;
      
      case Lazarus.STATE_GENERATING_KEYS:
        return;
      
      case Lazarus.STATE_DISABLED_FOR_DOMAIN:
        alert(Lazarus.getString('status.disabledfordomain'))
        return;
        
      case Lazarus.STATE_UNINITALIZED:
      default:
        Lazarus.error("Not initalized");
        return 
    }
  }
}


/**
* show the statusbar menu 
*/
Lazarus.openStatusbarMenu = function(evt){
  Lazarus.$('lazarus-statusbar-menupopup').openPopup(Lazarus.$('lazarus-statusbarpanel'), 'before_end', 0, 0, true);
}

/**
* open the options dialog
*/
Lazarus.openOptionsDialog = function(optionsPane){
  optionsPane = optionsPane || null;
		
		var features = "chrome,titlebar,toolbar,centerscreen,modal";
		features += Lazarus.getPref("browser.preferences.animateFadeIn", false) ? "" : ",resizable";
		
  window.open("chrome://lazarus/content/options.xul", "LazarusOptions", features, optionsPane);
}

/**
* open the about dialog
*/
Lazarus.openAboutDialog = function(){
  window.open("chrome://lazarus/content/about.xul", "LazarusAbout", "chrome,titlebar,toolbar,centerscreen,modal,resizable");
}

/**
* open the about dialog
*/
Lazarus.openLazarusWebsite = function(page){
  page = page || '';
  Lazarus.openURL(Lazarus.website + page, true, true);
}

/**
* open a URL in the current browser
*/
Lazarus.openURL = function(url, newTab, selectTab){
  var browser = document.getElementById('content');
  
  if (newTab){
    var tab = browser.addTab(url);
    if (tab && selectTab){
      browser.selectedTab = tab;
    }  
  }
  else {
    content.location = url;
  }
}


/**
* returns a localized string 
*/
Lazarus.getString = function(strId){
  try {
    var strbundle = Lazarus.$("lazarus-strings");

    if (arguments.length == 1){
      return strbundle.getString(strId);
    }
    else {
      var replacements = [];
      //NOTE: first argument is the strId
      for (var i=1; i<arguments.length; i++){
        replacements.push(arguments[i])
      }
      return strbundle.getFormattedString(strId, replacements);
    }
  }
  catch(e){
    Lazarus.error(e, "failed to getString ["+ strId +"]");
    return '';
  }
}


Lazarus.checkDatabase = function(db){
    //build the database tables
    try {
        //forms
        db.exe('CREATE TABLE IF NOT EXISTS forms (\
            id INTEGER PRIMARY KEY, formid TEXT, \
            created INT, \
            formname TEXT, \
            forminfo TEXT, \
            formtext TEXT, \
            savetype INT, \
            forminfohash TEXT, \
            formurl TEXT, \
            text_length INT, \
            autofill INT);');
        db.exe('CREATE INDEX IF NOT EXISTS index_forms_created ON forms (created  DESC)');
        db.exe('CREATE INDEX IF NOT EXISTS index_forms_formid ON forms (formid  ASC)');
        
        //settings
        db.exe('CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT)');
        
        //texdata
        db.exe('CREATE TABLE IF NOT EXISTS textdata (\
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, \
            text_encrypted TEXT, \
            text_hash TEXT, \
            text_length INT, \
            summary_encrypted TEXT, \
            created INTEGER DEFAULT \'0\' NOT NULL, \
            domain_hash TEXT, \
            url_encrypted TEXT, \
            savetype INTEGER \
            )');
            
        Lazarus.debug("DB: Creating indexes");
            
        db.exe('CREATE INDEX IF NOT EXISTS index_textdata_domain ON textdata (domain_hash ASC)');
        db.exe('CREATE INDEX IF NOT EXISTS index_textdata_created ON textdata (created DESC)');
        
        Lazarus.debug("DB: Creating Full Text indexes");
        
        //textdata full text index
        if (!db.tableExists('textdata_fulltext')){
            db.exe('CREATE VIRTUAL TABLE textdata_fulltext USING fts3(hashed_text)');
        }
        
        //forms: full text index
        if (!db.tableExists('forms_fulltext')){
            db.exe('CREATE VIRTUAL TABLE forms_fulltext USING fts3(hashed_text)');
        }
        
        Lazarus.debug("DB: Testing read/write");
        
        //test read and write 
        var now = (new Date()).getTime();
        db.exe("DELETE FROM settings WHERE name = 'last-accessed'");
        db.exe("INSERT INTO settings (name, value) VALUES ('last-accessed', ?1)", now);
        var lastAccessed = db.getInt("SELECT value FROM settings WHERE name = 'last-accessed'");
        var success = (lastAccessed === now);
        Lazarus.debug("DB: read/write success? "+ success);
        return success;
    }
    catch(e){
        Lazarus.error(e);
        return false;
    }
}

/**
* initalizes the database
*/
Lazarus.initDB = function(){
  //create / connect to the database 
  //we might have already connected in an update script.
  if (!Lazarus.Global.db){
	
    if (Lazarus.getPref("extensions.lazarus.deleteDatabase", false)){ 
      Lazarus.killPref("extensions.lazarus.deleteDatabase", false);
      Lazarus.killDB();
    }
    
    if (Lazarus.getPref("extensions.lazarus.restoreDatabase", false)){ 
      Lazarus.killPref("extensions.lazarus.restoreDatabase");
      if (Lazarus.file.exists("%profile%/lazarus-backup.sqlite")){
        Lazarus.file.move("%profile%/lazarus-backup.sqlite", "%profile%/lazarus.sqlite", true);
      }
      else {
        Lazarus.error("Unable to restore database: backup not found");
      }
    }
  
    //if a backup exists, and the original database is missing, then try and use the backup database
    if (Lazarus.file.exists("%profile%/lazarus-backup.sqlite") && !Lazarus.file.exists("%profile%/lazarus.sqlite")){
      Lazarus.file.move("%profile%/lazarus-backup.sqlite", "%profile%/lazarus.sqlite");
    }
		
		var debugging = Lazarus.getPref("extensions.lazarus.debugMode") > 3;
		
    var db = new Lazarus.SQLite("%profile%/lazarus.sqlite", false);
		db.debugging = debugging;
    if (!Lazarus.checkDatabase(db)){
      //save the corrupted database file
      Lazarus.warning("Database is corrupted, saving corrupt database");
      var d = Lazarus.formatDate(new Date(), true);
      Lazarus.file.kill("%profile%/lazarus-"+ d +"-corrupted.sqlite");
      Lazarus.file.move("%profile%/lazarus.sqlite", "%profile%/lazarus-"+ d +"-corrupted.sqlite");
      db = null;
    }
    
    //use the backup database if it exists.
    if (!db && Lazarus.file.exists("%profile%/lazarus-backup.sqlite")){
      Lazarus.warning("Restoring previous backup database");
      Lazarus.file.move("%profile%/lazarus-backup.sqlite", "%profile%/lazarus.sqlite");
      db = new Lazarus.SQLite("%profile%/lazarus.sqlite", false);
			db.debugging = debugging;
      if (!Lazarus.checkDatabase(db)){
				//delete the broken backup file
				Lazarus.file.kill("%profile%/lazarus.sqlite");
				db = null;
      }
    }
    
    if (!db){
      //delete any existing database, and build a new one from scratch
      Lazarus.file.kill("%profile%/lazarus.sqlite");
      db = new Lazarus.SQLite("%profile%/lazarus.sqlite", false);
			db.debugging = debugging;
      if (!Lazarus.checkDatabase(db)){
				//oh, so screwed
				Lazarus.error("Unable to create the Lazarus database");
				db = null;
      }
    }
    
    if (db){
      //ok we should now have a valid and checked database 
      //make a backup of it.
      //remove the old backup (if it exists)
      if (Lazarus.getPref("extensions.lazarus.backupDatabase")){
				Lazarus.debug("Backing up database");
				Lazarus.file.copy("%profile%/lazarus.sqlite", "%profile%/lazarus-backup.sqlite", true);
      }
    }
    
    Lazarus.Global.db = db;
  }
  
  Lazarus.db = Lazarus.Global.db;
  return Lazarus.db ? true : false;
}

Lazarus.autoCleanDB = function(){
	//clean the database, but only if it hasn't been cleaned in the last 24 hours
	
	if ((Lazarus.getPref("extensions.lazarus.lastCleanedTimed", 0) + (24 * 60 * 60)) < Lazarus.timestamp()){
		Lazarus.cleanDB();
	}
}

Lazarus.cleanDB = function(callback){
  //takes ages to clean the database
  Lazarus.debug("Cleaning database");
  Lazarus.cleaningDatabase = true;
  Lazarus.refreshIcon();
	
	Lazarus.db.exeAsync("VACUUM", [], function(){
		Lazarus.cleaningDatabase = false;
		Lazarus.setPref("extensions.lazarus.lastCleanedTimed", Lazarus.timestamp());
		Lazarus.refreshIcon();
		if (typeof callback === "function"){
			callback();
		}
	});
}

/**
* convert autosaved forms to semi-permanent save points 
*/
Lazarus.saveAutoSavedForms = function(){

	//convert autosaved forms to semi-permanent points
	var rs = Lazarus.db.rs("SELECT id, formid FROM forms WHERE savetype = "+ Lazarus.FORM_TYPE_AUTOSAVE +" ORDER BY formid, created DESC");
	var lastFormId = '';
	var lastFormCnt = 0;
	var MAX_AUTOSAVES_TO_KEEP = 2;
	
	//to make this less database intensive we'll get the list of id's that need to be updated
	//then update them in just a few transacations
	var remove = [];
	var keep = [];
	
	Lazarus.db.exe("BEGIN TRANSACTION");
	for (var i=0; i<rs.length; i++){
		var savedForm = rs[i];
		if (lastFormId != savedForm["formid"]){
			lastFormId = savedForm["formid"];
			lastFormCnt = 1;
		}
		else {
			lastFormCnt++;
		}
		
		if (lastFormCnt <= MAX_AUTOSAVES_TO_KEEP){
			keep.push(savedForm["id"]);
		}
		else {
			//excess saved form, remove it
			remove.push(savedForm["id"]);
		}
	}
	
	if (keep.length){
			Lazarus.db.exe('UPDATE forms SET savetype = '+ Lazarus.FORM_TYPE_STALE_AUTOSAVE +' WHERE id IN ('+ keep.join(',') +')');
	}
	if (remove.length){
			Lazarus.removeForms(remove);
	}
  Lazarus.db.exe("COMMIT TRANSACTION");
}

/**
* removes old/excess forms from the database
*/
Lazarus.removeOldForms = function(){

	var maxForms = Lazarus.getExtPref("maxSavesPerForm", 10);
	if (maxForms > 0){
		var rs = Lazarus.db.rs("SELECT count(*) as cnt, formid FROM forms WHERE savetype = "+ Lazarus.FORM_TYPE_NORMAL +" GROUP BY formid");
		
		var remove = [];
		
		for (var i=0; i<rs.length; i++){
			var save = rs[i];
			if (save["cnt"] > maxForms){
				Lazarus.debug("Removing excess forms "+ save["formid"]);
				var ids = Lazarus.db.getColumn("SELECT id FROM forms WHERE formid = ?1 AND savetype = "+ Lazarus.FORM_TYPE_NORMAL +" ORDER BY created DESC LIMIT -1 OFFSET ?2", save["formid"], maxForms);
				if (ids.length > 0){
					remove = remove.concat(ids);
				}
			}
		}
		
		if (remove.length){
			Lazarus.debug("Removing Old Forms: "+ remove.join(","));
			Lazarus.removeForms(remove);
		}
	}
}

/**
* empties all the tables in the database
* except those specified.
*/
Lazarus.emptyDB = function(ignoreFormTypes){
  //always remove text data
  Lazarus.db.exe('DELETE FROM textdata');
  Lazarus.db.exe('DELETE FROM textdata_fulltext');
  
  if (typeof ignoreFormTypes == "undefined"){
    Lazarus.db.exe('DELETE FROM forms');
    Lazarus.db.exe('DELETE FROM forms_fulltext');
  }
  else {
				var ids = Lazarus.db.getColumn('SELECT id FROM forms WHERE savetype NOT IN ('+ ignoreFormTypes +')');
				Lazarus.removeForms(ids);
  }
}

/**
* completely remove the database
*/
Lazarus.killDB = function(){
  Lazarus.file.kill("%profile%/lazarus.sqlite");
  Lazarus.file.kill("%profile%/lazarus-backup.sqlite");
}

/**
* run any update functions
*/
Lazarus.runUpdates = function(prevVersion){
  for(var key in Lazarus.updates){
    if (Lazarus.versionCompare(key, prevVersion) == 1){
      Lazarus.debug("running update "+ key);
      try {
        Lazarus.updates[key](prevVersion);
      }catch(e){
        Lazarus.error(e);
      }
    }
  }
}

/**
* fire a "clear-private-data" event if the user has asked to clear private data on shutdown with no prompt
*/
Lazarus.fireClearPrivateDataOnShutdown = function(){
  if (Lazarus.getPref("privacy.sanitize.sanitizeOnShutdown", false) && !Lazarus.getPref("privacy.sanitize.promptOnSanitize", true)){
    Lazarus.Event.fire("clear-private-data");
  }
}

/**
* clear private data if all the preferences say so
*/
Lazarus.onClearPrivateData = function(action){  
  if (Lazarus.getExtPref("privacy.item.saved.forms")){
    Lazarus.emptyDB(Lazarus.FORM_TYPE_TEMPLATE);
    Lazarus.debug("ClearPrivateData: removing all forms");
  }
}

/**
* return TRUE if lazarus requires a password before data can be decrypted
*/
Lazarus.isPasswordSet = function(){
  //we test this by attempting to decrypt the private key with a blank password
  var encb64Key = Lazarus.db.getStr("SELECT value FROM settings WHERE name = 'private-key'");
  //we need to unencrypt the private key
  return Lazarus.Crypto.AESDecrypt(encb64Key, "") ? false : true;
}

/*
* encrypts a string
*/
Lazarus.encrypt = function(str){
  return Lazarus.Crypto.encrypt(str);
}

/*
* encrypts a string
*/
Lazarus.decrypt = function(str){
  return Lazarus.Crypto.decrypt(str);
}


/*
* encrypts a string
*/
Lazarus.encrypt2 = function(str){
  //hmmm interesting, the encrypted string is not always the same.
  //a certain amount of decryption information must be kept within the encrypted string
  //so we cannot compare encrypted string against each other to test if they are the same
  //all encrypted string must be DECRYPTED before comparison.
  
  //Unable to decrypt extended characters (eg \u8888)!
  //IMPORTANT: extended characters are not correctly encoded/decoded in the bsao function used by the encryptor, so (as of 2008-07-24) 
  //we'll be encoding all strings before encrypting them, and then decoding afterwards.
  //by adding a 4 character header ("uri:") we can tell which type of string we have (encodeURIComponent).
  
  Lazarus.decoderRing = Lazarus.decoderRing || Components.classes["@mozilla.org/security/sdr;1"].getService(Components.interfaces.nsISecretDecoderRing);
  var encStr = encodeURIComponent(str);
  return "uri:"+ Lazarus.decoderRing.encryptString(encStr);
}

/**
* decrypt a string
*/
Lazarus.decrypt2 = function(str){
  //IMPORTANT: extended characters (eg \u8888) are not correctly encoded/decoded, so (as of 2008-07-24) 
  //we'll be encoding all strings before encrypting them, and then decoding afterwards.
  //by inspecting the 4 character header we can tell which type of string we have.
  Lazarus.decoderRing = Lazarus.decoderRing || Components.classes["@mozilla.org/security/sdr;1"].getService(Components.interfaces.nsISecretDecoderRing);
  if (str.indexOf("uri:") == 0){
    str = str.substr(4);
    var strEnc = Lazarus.decoderRing.decryptString(str);
    return decodeURIComponent(strEnc);
  }
  else {
    return Lazarus.decoderRing.decryptString(str);
  }
}

/**
* calulate md5 hash of a string
* ref: http://developer.mozilla.org/en/docs/nsICryptoHash#Computing_the_Hash_of_a_String
*/
Lazarus.md5 = function(str){

  var nsICryptoHash = Components.classes['@mozilla.org/security/hash;1'].createInstance(Components.interfaces.nsICryptoHash);

  var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  // result is an out parameter,
  // result.value will contain the array length
  var result = {};
  // data is an array of bytes
  var data = converter.convertToByteArray(str, result);
  
  nsICryptoHash.init(Components.interfaces.nsICryptoHash.MD5);
  nsICryptoHash.update(data, data.length);
  var hash = nsICryptoHash.finish(false);
  
  // Unpack the binary data bin2hex style
  var ascii = [];
  var len = hash.length;
  for (var i = 0; i < len; ++i) {
    var c = hash.charCodeAt(i);
    var ones = c % 16;
    var tens = c >> 4;
    ascii.push(String.fromCharCode(tens + (tens > 9 ? 87 : 48)) + String.fromCharCode(ones + (ones > 9 ? 87 : 48)));
  }
  return ascii.join('');
}


/**
* return TRUE if master password is set
*/
Lazarus.isMasterPasswordSet = function(){
  var secmodDB = Components.classes["@mozilla.org/security/pkcs11moduledb;1"].getService(Components.interfaces.nsIPKCS11ModuleDB);
  var slot = secmodDB.findSlotByName("");
  return (slot && (slot.status == Components.interfaces.nsIPKCS11Slot.SLOT_NOT_LOGGED_IN || slot.status == Components.interfaces.nsIPKCS11Slot.SLOT_LOGGED_IN));
} 

/**
* return TRUE if a user has set the firefox master password and has not yet logged in.
*/
Lazarus.isMasterPasswordRequired = function(){
  var secmodDB = Components.classes["@mozilla.org/security/pkcs11moduledb;1"].getService(Components.interfaces.nsIPKCS11ModuleDB);
  var slot = secmodDB.findSlotByName("");
  return (slot && slot.status == Components.interfaces.nsIPKCS11Slot.SLOT_NOT_LOGGED_IN);
}

/**
* 
*/
Lazarus.enterMasterPassword = function(){

  //encrypting a string should open the enter master password dialog
  try {
    var decoderRing = Components.classes["@mozilla.org/security/sdr;1"].getService(Components.interfaces.nsISecretDecoderRing);
    decoderRing.encryptString("dummy");
    return true;
  }
  catch(e){
    return false;
  }
}


Lazarus.openGenerateKeysDialog = function(){
  window.open("chrome://lazarus/content/generate-keys.xul", "LazarusGenerateKeys", "chrome,dialog,modal,resizable,centerscreen");
}

/**
* dictionary of notification to display in the popup.
*/
Lazarus.notifications = {};
Lazarus.notifications["password-required"] = {
  "buttons" : [
    {
      "label-string": "notification.password.required.button1.label",
      "accessKey-string": "notification.password.required.button1.accesskey",
      "callback": function(notif, label){
        Lazarus.showEnterPasswordDialog();
        Lazarus.refreshIcon();
      }
    }
  ],
  "text-string" : "notification.password.required.text",
  "iconUrl" : "chrome://lazarus/skin/lazarus-error.png"
}

Lazarus.notifications["password-required-autofill"] = {
  "buttons" : [
    {
      "label-string": "notification.password.required.autofill.button1.label",
      "accessKey-string": "notification.password.required.autofill.button1.accesskey",
      "callback": function(notif, label){
        Lazarus.showEnterPasswordDialog();
        Lazarus.refreshIcon();
        Lazarus.autofillDoc(content.document);  
      }
    }
  ],
  "text-string" : "notification.password.required.autofill.text",
  "iconUrl" : "chrome://lazarus/skin/lazarus-error.png"
}

Lazarus.notifications["form-restored"] = {
  "buttons" : [
    {
      "label-string": "notification.form.restored.button1.label",
      "accessKey-string": "notification.form.restored.button1.accesskey",
      "callback": function(notif, label){ 
				
				var data = Lazarus.$('lazarus-notification').getAttribute('lazarus-data');
				var page = 'donate.html';
        page += (data) ? ('?'+ data) : '';
        Lazarus.openLazarusWebsite(page);
      }
    }
  ],
  "text-string" : "notification.form.restored.text",
  "iconUrl" : "chrome://lazarus/skin/lazarus.png"
}

/**
* displays the lazarus notification box 
*/
Lazarus.showNotificationBox = function(id, text, data){
  var notif = Lazarus.notifications[id];
  
  if (Lazarus.$('lazarus-notification').currentNotification && Lazarus.$('lazarus-notification').currentNotificationId == id){
    //do nothing, notification box is already shown
  }
  else if (notif){
    //translate text, and buttons
    if (text){
      notif["text"] = text;
    }
		else if (!notif["text"] && notif["text-string"]){
      notif["text"] = Lazarus.getString(notif["text-string"]);
    }
    
    for (var i=0; i<notif.buttons.length; i++){
      var button = notif.buttons[i];
      if (!button["label"] && button["label-string"]){
        button["label"] = Lazarus.getString(button["label-string"]);
      }
      if (!button["accessKey"] && button["accessKey-string"]){
        button["accessKey"] = Lazarus.getString(button["accessKey-string"]);
      }
    }
    
    var notificationBox = Lazarus.$('lazarus-notification');
		notificationBox.setAttribute('lazarus-data', data || '');
    notificationBox.currentNotificationId = id;
    notificationBox.appendNotification(notif["text"], id, notif["iconUrl"], notificationBox.PRIORITY_INFO_LOW, notif["buttons"]);
  }
  else {
    Lazarus.error(Error("Lazarus: invalid notification id ["+ id +"]"));
  }
}

/**
* closes the notification box
*/
Lazarus.closeNotificationBox = function(immediate){
  Lazarus.$('lazarus-notification').removeAllNotifications(immediate);
}

/**
* returns a list of the templates found in the database
*/
Lazarus.getTemplateNames = function(){
  return Lazarus.db.getColumn("SELECT formname FROM forms WHERE savetype = "+ Lazarus.FORM_TYPE_TEMPLATE +" ORDER BY formname");  
}

/**
* handle user clicking on the "Save form as template..." menuitem
*/
Lazarus.onSaveFormMenuItem = function(){
  //find the current form
  var form = Lazarus.findFormFromElement(gContextMenu.target, "form");
  
  //and show the save as template dialog
  if (form){
    var info = Lazarus.formInfo(form, Lazarus.FORM_TYPE_NORMAL);
    var args = {};
    args.templateName = '';
    //add the names of the current templates within the database
    args.templateNames = Lazarus.getTemplateNames();
    //suggest using the default name for this form
    args.defaultName = Lazarus.getMenuItemText(info.formtext) || ("["+ Lazarus.getString("untitled") +"]");
    //WYSIWYG and TEXTAREAs cannot be autofilled
    args.isTextarea = form.isTextarea;
    args.isIframe = form.isIframe;
    
    //IMPORTANT: must use open dialog here otherwise the arguments are not passed.
    window.openDialog("chrome://lazarus/content/template-save.xul", "LazarusTemplateSave", "chrome,modal,resizable", args);
    if (args.templateName){
      Lazarus.saveForm(form, Lazarus.FORM_TYPE_TEMPLATE, args.templateName, args.autofill);
    }
  }
  //or throw an error
  else {
    alert(Lazarus.getString("error.form.object.not.found"));
    Lazarus.error(Error("Unable to find form in the document"));  
  }
}

/**
* compare two version numbers (eg 2.0.0.1beta3, 2.0.0rc1)
* return 1 if version1 > version2
* return 0 if version1 == version2
* return -1 if version1 < version2
*/
Lazarus.versionCompare = function(version1, version2){

  function getValueOfVersionSegment(seg){
  
    if (typeof seg === "undefined"){
      return 0;
    }
    else if (/^\d+$/.test(seg)){
      return parseInt(seg);
    }
    else {
      switch(seg){
        case "rc": return -1;
        case "beta": return -2;
        case "alpha": return -3;
        case "dev": return -4;
        default:
          throw Error("Lazarus.versionCompare: Unknown version fragment ["+ seg +"]");
      }
    }
  }

  //verify version strings
  var regexVerify = /^[\d\.(dev|alpha|beta|rc)]+$/i;
  
  if (!regexVerify.test(version1)){
    Lazarus.error("Lazarus.versionCompare: Invalid version string ["+ version1 +"]");
    version1 = "0";
  }
  else if (!regexVerify.test(version2)){
    Lazarus.error("Lazarus.versionCompare: Invalid version string ["+ version2 +"]");
    version2 = "0";
  }
  
  //split each version into sections 
  var ver1 = version1.toLowerCase().replace(/(\w)(\d)/g, "$1.$2").replace(/(\d)(\w)/g, "$1.$2").split(/[\.\b]/g);
  var ver2 = version2.toLowerCase().replace(/(\w)(\d)/g, "$1.$2").replace(/(\d)(\w)/g, "$1.$2").split(/[\.\b]/g);
  
  //compare each section until a non match occurs
  var maxLen = Math.max(ver1.length, ver2.length);
  for (var i=0; i<maxLen; i++){
    //convert the version segment into a numeric value
    var seg1 = (typeof ver1[i] === "undefined") ? 0 : getValueOfVersionSegment(ver1[i]);
    var seg2 = (typeof ver2[i] === "undefined") ? 0 : getValueOfVersionSegment(ver2[i]);
    
    if (seg1 > seg2){
      return 1;
    }
    else if (seg1 < seg2){
      return -1;
    }      
  }
  //all parts are equal
  return 0;
}


/**
* return the path to this extension install directory
* gives correct path even if extension is not installed in a users profile directory.
*/
Lazarus.getExtensionDir = function(extId){
  // the extension's id from install.rdf
  extId = extId || Lazarus.guid;
  var em = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
  return em.getInstallLocation(extId).getItemFile(extId, "install.rdf").parent.path;
}

/**
* check the website to see if there is a new update available
*/
Lazarus.checkForUpdates = function(){
  //never check more than once a day
  if (Lazarus.getExtPref("lastUpdateCheck") + (24 * 60 * 60) < Lazarus.timestamp()){
    Lazarus.setExtPref("lastUpdateCheck", Lazarus.timestamp());
    
    // create browser
    var browser = document.createElement("browser");
    browser.collapsed = true;
    //browser.style.height = "0px";
    document.documentElement.appendChild(browser);
    
    // set restrictions as needed
    browser.webNavigation.allowAuth = false;
    browser.webNavigation.allowImages = true;
    browser.webNavigation.allowJavascript = true; // so the google analytic code works
    browser.webNavigation.allowMetaRedirects = false;
    browser.webNavigation.allowPlugins = false;
    browser.webNavigation.allowSubframes = false;
    
    // listen for load
    browser.addEventListener("DOMContentReady", function(evt){
      // the document of the HTML in the DOM
      var doc = evt.originalTarget;
      //check URL (could be about:blank)
      if (doc && doc.URL != "about:blank"){
        var ele = doc.getElementById('latest-stable');
        if (ele && ele.innerHTML){
          Lazarus.setExtPref("lastestStableVersion", ele.innerHTML);   
        }
        var ele = doc.getElementById('latest-beta');
        if (ele && ele.innerHTML){
          Lazarus.setExtPref("lastestBetaVersion", ele.innerHTML);   
        }
        // remove browser element when done
        // mouse pointer has loading symbol unless we do this?
        browser.contentDocument.location = "about:blank";
        browser.parentNode.removeChild(browser);
      }
    }, true);
    
    // load update check
    browser.contentDocument.location.href = "http://lazarus.interclue.com/version-check.php";   

    //check again tomorrow
    setTimeout(Lazarus.checkForUpdates, 24 * 60 * 60 * 1000);
  }
  else {
    //didn't check, so check again in 10 minutes
    setTimeout(Lazarus.checkForUpdates, 10 * 60 * 1000);
  }
}


/**
* return TRUE if the user is in private Browsing mode (Fx 3.1+)
*/
Lazarus.isPrivateBrowsing = function(){

  try {
    return Components.classes["@mozilla.org/privatebrowsing;1"] && Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService).privateBrowsingEnabled;
  }
  catch(e){
    return false;
  }
}

/**
* return TRUE if Lazarus is currently disabled because the user is in private browsing mode
*/
Lazarus.isDisabledByPrivateBrowsing = function(){
	return (Lazarus.isPrivateBrowsing() && !Lazarus.getPref("extensions.lazarus.enableInPrivateBrowsingMode"));
}

/**
* return an FNV1a hash of the given string
*/
Lazarus.FNV1a = function(str, seed){
  
  //hash = offset_basis
  var hash = seed ? parseInt(seed, 16) : 2166136261;
  
  //only calculate the length once
  var len = str.length;
  
  //for each octet_of_data to be hashed
  for (var i=0; i<len; i++){
  
    hash ^= str.charCodeAt(i);
    
    //hash = hash * FNV_prime (apparently this bitshifting does the same thing)
    hash += ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24));
  }
  
  return Math.abs(Number(hash & 0x00000000ffffffff)).toString(16);
}


Lazarus.openTextManager = function(){

  //if not logged in close window
  if (!Lazarus.canDecrypt()){
    //try loggin in immediately
    Lazarus.showEnterPasswordDialog();
  }
  
  //if they still can't login do nothing
  if (Lazarus.canDecrypt()){
    window.open("chrome://lazarus/content/text-manager.xul", "", "chrome,centerscreen,resizable");
  }
}

/**
*
**/
Lazarus.refreshMenuIcons = function(){

  var items = {
    'lazarus-enterpassword-contextmenuitem': 'chrome://lazarus/skin/lazarus-login.png',
    'lazarus-restoretext-submenu': 'chrome://lazarus/skin/lazarus.png',
    'lazarus-restoretextdisabled-contextmenuitem': 'chrome://lazarus/skin/lazarus-disable.png',
    'lazarus-restoreform-contextmenuitem': 'chrome://lazarus/skin/lazarus.png',
    'lazarus-restoreform-submenu': 'chrome://lazarus/skin/lazarus.png',
    'lazarus-submenu-menuitem-donate': 'chrome://lazarus/skin/donate.png',
    'lazarus-domaindisabled-contextmenuitem': 'chrome://lazarus/skin/lazarus-disabled.png',
    'lazarus-privatebrowsing-contextmenuitem': 'chrome://lazarus/skin/lazarus-disabled.png'
  };
  
  var show = Lazarus.getPref('extensions.lazarus.showContextMenuIcons');
  
  for(var id in items){
    Lazarus.setMenuIcon(document.getElementById(id), show ? items[id] : null);
  }
}


/**
* 
*/
Lazarus.setMenuIcon = function(ele, iconURL){
  var classname = ele.tagName.toLowerCase() +"-iconic";
  
  if (iconURL){
    ele.setAttribute("image", iconURL);
    Lazarus.addClass(ele, classname);
  }
  else {
    //remove the icon
    ele.setAttribute("image", "");
    Lazarus.removeClass(ele, classname);
  }
}


/**
* return TRUE if class exists 
*/
Lazarus.classExists = function(ele, classname){
  var currName = ele.getAttribute('class') || '';
  return ((" "+ currName.toLowerCase() +" ").indexOf(" "+ classname.toLowerCase() +" ") > -1);
}


/**
* adds a classname to an element if the name doesn't exist
*/
Lazarus.addClass = function(ele, classname){
  if (!Lazarus.classExists(ele, classname)){
    ele.setAttribute('class', (ele.getAttribute('class') || '') +" "+ classname);
  }
}


/**
* remove a classname from an element
*/
Lazarus.removeClass = function(ele, classname){
  if (Lazarus.classExists(ele, classname)){
    var newClassname = ele.getAttribute('class').toLowerCase().replace(classname.toLowerCase(), "").replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    ele.setAttribute('class', newClassname);
  }
}

/**
* call a function after X seconds of the user being idle (no mouse or keyboard events)
**/
Lazarus.addIdleObserver = function(func, interval){

	//BUGFIX: idle observers are being called when computer wakes frm hybernation
	//so all the observers are being called at once.
	//to avoid this, we'll add another idle observer (idleChecker) after 30 seconds that
	//will save the current timestamp.
	//when the "real" observer fires, we should compare the times, and only fire it if
	//it is within a realistic range from the idleChecker timestamp
	
	var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].getService(Components.interfaces.nsIIdleService)
	var idleObserver = {
		observe: function(subject, topic, data){
			if (topic == "idle"){
				//fetch the last added 
				var idleStartTime = Lazarus.getPref("extensions.lazarus.idleStart", 0);
				var now = Lazarus.timestamp();
				if (idleStartTime && Lazarus.timestamp() < idleStartTime + interval){
					Lazarus.debug("firing idle observer");
					func(subject, topic, data);
				}
				else {
					//ignore this idle time, it's probably caused by coming out of hybernation
				}
			}
		}
	};
	idleService.addIdleObserver(idleObserver, interval);
	
	var startTime = 30;
	var idleCheckerObserver = {
		observe: function(subject, topic, data){
			if (topic == "idle"){
				Lazarus.setPref("extensions.lazarus.idleStart", Lazarus.timestamp());
			}
		}
	};
	idleService.addIdleObserver(idleCheckerObserver, startTime);
}




/**
* 
*/
Lazarus.test = function(evt){

}




Lazarus.icon = "data:image/png;base64,\
iVBORw0KGgoAAAANSUhEUgAAAAsAAAAOCAYAAAD5YeaVAAAALHRFWHRDcmVhdGlvbiBUaW1lAFRo\
dSAxMiBOb3YgMjAwOSAxMzoxOToxNiArMTIwMJCaV2oAAAAHdElNRQfZCwwAFimayURVAAAACXBI\
WXMAAAsSAAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAASZJREFUeNq1ks1KAmEUhh+/GZkGs6IS\
gzYhhREEwbRw56IbSaIbaNe+K2gvFEWB11Cgm4LUKKGfRRqVpKVTpkJpOpOJow6ufVfn8D7nfC8f\
B4YlR39zesHc8wPrRpNx9xildJrw9hZZyxdWkUggV3XWLhPcn8XZcQoyX2W0/mVdODPSesWBojh5\
D+/yYTp4q+g93wZ//mA6Fc4XFlnaO8L38sS8XuIuEukxslWsSISaE3xLPvzVCv56g9rGJpVcltWW\
fWiDYzHU/Ct4vDy6RwlcX3Fyk4Ji0f4JbWlae1CKpwjsH3MQCrHciSkGMieTNEwTwzSYUhQmJRVv\
xzIG4H9Fo4haHa8QuFwqs8GgPYLc3xQ8iN9bpvM51GqZmUKhvaw5tJPo6g+jvlxgBqGatwAAAABJ\
RU5ErkJggg==";

