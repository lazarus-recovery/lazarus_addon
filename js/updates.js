

Lazarus.Updates = {

  "166": function(callback){
    //updates to database schema
    Lazarus.Background.rebuildDatabase(callback)
  },
  
  
  "234": function(callback){
    //removing the hash seed so we can sync databases
    //hash seed *might* still be used for the encrypted full text index, we'll see
    Lazarus.Background.rebuildDatabase(callback)
  },
  
  
  "235": function(callback){
    //moving disabled domains into the database so they get synced
    Lazarus.getPref("disabledDomains", "", function(domainStr){
      var disabledDomains = domainStr.split(/\s*,\s*/g);
      var newDomains = Lazarus.Utils.arrayToMap(disabledDomains);
      Lazarus.Background.setSetting("disabledDomains", newDomains, function(){
        callback();
      });
    });
  },
  
  
  "443": function(callback){
    //separating the field value into "encoding" and "value" fields
    Lazarus.Utils.callAsyncs(Lazarus.db.exe, [
      ["ALTER TABLE fields ADD COLUMN encryption TEXT"],
      ["ALTER TABLE forms ADD COLUMN encryption TEXT"]
    ], function(){
      //we need to update all the existing fields and their values.
      //or do we? No, we'll check their values when retrieving them and eventually the 
			//older values will be removed
      callback();
    });
  },
  
  "445": function(callback){
    //add editing time statistics to forms and domains
    //NOTE: we don't need to add editing time to the domains table, because that should be being built during the update
    Lazarus.Utils.callAsyncs(Lazarus.db.exe, [
      ["ALTER TABLE forms ADD COLUMN editingTime INTEGER"]
    ], function(){
      callback();
    });
  },
  
  
  "624": function(callback){
    //if the user has syncing enabled, then we need to get them to switch sync servers (to http://lazarus-sync.EXAMPLE.com/)
    //this will require them to setup a new sync account.
    Lazarus.getPrefs(["syncEnabled" , "syncEmail"], function(prefs){
      if (prefs.syncEnabled){
        Lazarus.setPref('syncEnabled', false, function(){
          Lazarus.setPref('syncKey', '', function(){
            Lazarus.setPref('userId', '', function(){
              Lazarus.Background.setSetting('lastSyncTime', 0, function(){
                //open the options dialog and show the "recreate account" info
                //stop the sync service (it'll be broken anyway because we've changed servers)
                Lazarus.Background.openOptions({msgid: 'options.sync.recreateAccount', msgtype: 'error'});
                callback();
              });
            });
          });
        });
      }
      else {
        callback();
      }
    });
  }
  
  
  
  
  
  

}