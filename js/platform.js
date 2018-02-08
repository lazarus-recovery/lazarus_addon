(function(ns){

  var platform = ns.platform = {
  
    //calculate platform identifier
    id: ((typeof InstallTrigger !== 'undefined') ? "firefox" : 
      (window.chrome ? "chrome" : window.safari ? "safari" : "unknown")),
  
    is: function(id){
      return (platform.id == id);
    },
  
    //overwrites properties and methods of this object with platform specific functionality
    overwrite: function(props){
      for(var prop in props){
        platform[prop] = props[prop];
      }
    },
    
    
    fullURL: function(url){
      return url.match(/^[\w\-]+:/) ? url : (platform.baseURI + url);
    },
    
    
    getPref: function(prefId, defaultVal){
      //default is to use localStorage
      if (typeof localStorage[prefId] !== "undefined"){
        try {
          return JSON.parse(localStorage[prefId]);
        }catch(e){
          ns.error("Invalid or corrupted preference", prefId, localStorage[prefId]);
          return defaultVal;
        }
      }
      else {
        return defaultVal
      }
    },
    
    setPref: function(prefId, val){
      var json = JSON.stringify(val);
      if (localStorage[prefId] != json){
        localStorage[prefId] = json;
        return true;
      }
      else {
        return false;
      }
    },
    
    resetPref: function(prefId){
      if (typeof localStorage[prefId] !== "undefined"){
        delete localStorage[prefId];
      }
    },
    
    //return TRUE is browser is currently in private browsing mode
    isPrivateBrowsingEnabled: function(){
      //Chrome and Safari have a built in UI to enable and disable addons for private browsing mode
      //so if our code is running then either private browsing is off, or the user has specifically enabled the addon
      //during private browsing sessions
      return false;
    }
  }


})(Lazarus);