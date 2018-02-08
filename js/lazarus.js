//setup our namespace

var Lazarus = {

  version: "3.2",
  
  updateChannel: "stable",
  
	build: 692,
  
  databaseVersion: 2,
  
  //location of sync server
  SYNC_SERVER: 'http://lazarus-sync.EXAMPLE.com/api/v2',
  // testing
  //SYNC_SERVER: 'http://localhost/lazarus/lazarus-3/sync/api/beta',
  
  URL_UPDATE_CHECK: 'http://getlazarus.EXAMPLE.com/updates/update-check.php?platform={platform}&version={version}&channel={updateChannel}&format=json',
  
  URL_SYNC_INFO: 'http://getlazarus.EXAMPLE.com/Sync',
  
  URL_ONINSTALL: {
    'stable': 'http://getlazarus.EXAMPLE.com/First_Run',
    'beta': 'http://getlazarus.EXAMPLE.com/First_Run',
  },
  
  URL_ONUPDATE: {
    'stable': 'http://getlazarus.EXAMPLE.com/Lazarus-Has-Been-Updated',
    'beta': 'http://getlazarus.EXAMPLE.com/Lazarus-Beta-Has-Been-Updated'
  },
  
  //various states of the addon
  //we're using strings here instead of integers so the log files make more sense.
  //all code should still use the variables here instead of hard coded string though
  STATE_UNINITIALIZED: 'uninitialized',
  STATE_LOADING: 'loading',
  STATE_ENABLED: 'enabled',
  
  
  DISABLED_BY_USER: 'user',
  DISABLED_BY_PROTOCOL: 'protocol',
  DISABLED_BY_PLATFORM: 'platform', 
  
  //some platforms will not let an extension affect pages on a particular domain (eg chrome and chrome.google.com, safari and extensions.apple.com)
  PLATFORM_DISABLED_DOMAINS: {
    "chrome": "chrome.google.com",
    "safari": "extensions.apple.com"
  },
  
  //NOTE: these may be overwritten in platform.js for platform specific icons (eg Chrome expects a 19x19 pixel icon, Safari expects a 16x16 px black icons with alpha channel, etc...)
  toolbarIcons: {
    'enabled': 'images/toolbar-icon-enabled.png',
    'enabling': 'images/toolbar-icon-enabling.png',
    'disabled': 'images/toolbar-icon-disabled.png',
    'disabledForURL': 'images/toolbar-icon-cancel.png',
    'syncError': 'images/toolbar-icon-warning.png',
    'syncMessages': 'images/toolbar-icon-messages.png'
  },
	
	msg: function(msg, type, replacements){
    if (typeof msg == "string" && msg.match(/^[\w\.]*$/)){
      msg = Lazarus.locale.getString(msg, replacements, false);
    }
    if (window.$ && window.$.msg){
      $.msg(msg, type);
    }
    else {
      alert(msg);
    }
	},
  
  getPrefs: function(prefs, callback){
    var values = {};
    
    var getNextPref = function(){
      if (prefs.length > 0){
        var pref = prefs.shift();
        Lazarus.getPref(pref, function(val){
          values[pref] = val;
          getNextPref();
        });
      }
      else {
        callback(values);
      }
    }
    getNextPref();
  }
	
	//TODO: implement setPrefs?
};

