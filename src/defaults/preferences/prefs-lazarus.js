
//lazarus version number, used for checking for new installs and updates
pref("extensions.lazarus.version", "");

//should saved forms expire?
pref("extensions.lazarus.expireSavedForms", true);

//keep saved forms for X minutes before removing them from the database
pref("extensions.lazarus.expireSavedFormsInterval", 4);
pref("extensions.lazarus.expireSavedFormsUnit", 10080);

//should we save/restore hidden fields
pref("extensions.lazarus.saveHiddenFields", false);

//should we save/restore password fields
pref("extensions.lazarus.savePasswordFields", false);

//should we save/restore search forms (GET forms containing a single textbox) 
pref("extensions.lazarus.saveSearchForms", true);

//save current form if the user stops typing for X many milliseconds
pref("extensions.lazarus.autoSaveInterval", 5000);

// See http://kb.mozillazine.org/Localize_extension_descriptions
pref("extensions.lazarus@interclue.com.description", "chrome://lazarus/locale/lazarus.properties");

//maximum number of save points for a given form
pref("extensions.lazarus.maxSavesPerForm", 8);

//maximum number of autosave points to show in the submenu for a given form
pref("extensions.lazarus.maxAutosavesPerForm", 3);

//maximum number of items to show in the "restore text" submenu
pref("extensions.lazarus.maxTextItemsInSubmenu", 20);

//should we clear saved forms when "Clearing Private Data"
pref("extensions.lazarus.privacy.item.saved.forms", false);

//show the lazarus icon in the status bar
pref("extensions.lazarus.showInStatusbar", true);

//show the lazarus icons in the context menu 
pref("extensions.lazarus.showContextMenuIcons", true);

//Allows the user to play with Experimental parts of the program
pref("extensions.lazarus.includeExperimental", false);

//use the first line of text from the saved form as the label of each submenuitem?
//time of save will be used if this is false.
pref("extensions.lazarus.showFormTextInSubMenu", true);

//last time we checked for updates
pref("extensions.lazarus.checkForUpdates", true);
pref("extensions.lazarus.checkForUpdatesBeta", false);
pref("extensions.lazarus.lastUpdateCheck", 0);

//cleanup data on uninstall
pref("extensions.lazarus.uninstall.removeUserSettings", false);
pref("extensions.lazarus.uninstall.removeSavedForms", false);

//debugMode, shows debugging messages in the js console
// 0 : None
// 1 : Errors
// 2 : Warnings
// 3 : Messages
// 4 : DebugMessages
pref("extensions.lazarus.debugMode", 1);

//should we build a searchable full text index of saved text fields
pref("extensions.lazarus.disableSearch", false);

//show a notification when a form is fully restored
pref("extensions.lazarus.showDonateNotification", true);

//should Lazarus be enabled when in private browsing mode
pref("extensions.lazarus.enableInPrivateBrowsingMode", false);

//should we generate a backup of the database
pref("extensions.lazarus.backupDatabase", true);

//interval (in minutes) the user must be idle for before we automatically clean the database
//set to 0 to disable autocleaning of the database
//NOTE: database will only be cleaned once per day by this method
pref("extensions.lazarus.autoCleanIdleInterval", 4);

//should we replace credit card numbers
pref("extensions.lazarus.replaceCreditCardNumbers", true);
