/*
Firefox specific functionality
*/

(function(ns){

  
  if (ns.platform.id == "firefox"){
    
    Lazarus.baseURI = "chrome://lazarus/content/";

    Lazarus.extensionId = "lazarus@interclue.com";

    Lazarus.preferencePrefix = "extensions.lazarus.";

    
    //additional prefs for Firefox
    if (Lazarus.prefs){
      Lazarus.prefs['firefoxToolbarButtonInstalled'] = false;
    }

    /**
    * return a preference
    */
    Lazarus.getPref = function(prefName, defaultVal, callback){
      if (typeof defaultVal == "function"){
        callback = defaultVal;
        defaultVal = null;
      }

      var name = Lazarus.preferencePrefix + prefName;

      if (Lazarus.environment == "background"){

        var branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        var prefType = branch.getPrefType(name);
        var val;
        
        switch (prefType){
          case 32 : //string
            val = branch.getComplexValue(name, Components.interfaces.nsISupportsString).data;
          break;
          
          case 64 : //int
            val = branch.getIntPref(name);
          break;
          
          case 128: //bool
            val = branch.getBoolPref(name);
          break;
          
          case 0:
            //preference has not been set
            //use the default preference
            if (typeof Lazarus.prefs[prefName] !== "undefined"){
              val = Lazarus.prefs[prefName];
            }
            else if (defaultVal !== null && typeof defaultVal != "undefined"){
              val = defaultVal;
            }
            else {
              throw Error("Unknown preference '"+ prefName +"'");
            }
          break;
          
          default:
            throw Error("Lazarus: Unsupported preference datatype ["+ name +","+ prefType +"]");
          break;
        }
        
        setTimeout(function(){
          callback(val);
        }, 1);
      
      }
      else {
        Lazarus.callBackground("Lazarus.getPref", [prefName, defaultVal, callback]);
      }
    }
      

    /**
    * set a preference
    */
    Lazarus.setPref = function(prefName, val, callback){

      callback = callback || function(){}

      var name = Lazarus.preferencePrefix + prefName;
      
      if (Lazarus.environment == "background"){
        Lazarus.getPref(prefName, function(oldVal){
          if (val !== oldVal){
              
            var returnVal = true;
            var branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
            
            if (val === null){
              branch.deleteBranch(name);
            }
            else {
              switch (typeof(val)){
                case "boolean":
                  branch.setBoolPref(name, val);
                break;
                
                case "string":
                  //branch.setCharPref(name, val);
                  //Unfrakking believable, unicode strings require us to use a "special" function
                  //ref: https://developer.mozilla.org/en/Code_snippets/Preferences
                  var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
                  str.data = val;
                  branch.setComplexValue(name, Components.interfaces.nsISupportsString, str);
                break;	
                
                case "number":
                  branch.setIntPref(name, val);
                break;
                
                default:
                  throw Error("Unable to save pref of type "+ typeof(val));
              }
            }
            Lazarus.Event.fire("preferenceChange", [prefName, val, oldVal]);
          }
          callback(true);
        });
      }
      else {
        Lazarus.callBackground("Lazarus.setPref", [prefName, val, callback]);
      }
    }


    /**
    * reset all preferences back to their default values
    **/
    Lazarus.resetPrefs = function(callback){
      
      callback = callback || function(){}
      
      var branch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
      branch.deleteBranch(Lazarus.preferencePrefix);
      
      setTimeout(function(){
        callback(true);
      }, 1);
    }


    /**
    * call a function on the background page
    **/
    Lazarus.callBackground = function(funcName, args){
      //bugger, can't use postMessage because evt.source is missing when the source is a XUL window
      args = args || [];
      
      var callbackInfo = {
        cmd: "call-background",
        funcName: funcName,
        args: args,
        source: window,
        callbackIndex: -1
      };
      
      var callback = function(){};
      for (var i=0; i<args.length; i++){
        //we'll assume that the background function only has one function argument, and that argument is the callback function
        if (typeof args[i] == "function"){
          if (callbackInfo.callbackIndex != -1){
            //bugger a callback function has already been defined.
            throw Error("callBackground function can take at most ONE function argument. More than one given. "+ args);
          }
          else {
            callbackInfo.callbackIndex = i;
          }
        }
      }
      
      //call the function directly
      
      if (Lazarus.logger){
        Lazarus.logger.log("call-background", callbackInfo, window.Lazarus.environment);
      }
      
      var bgWin = Lazarus.getBackgroundWindow();
      if (bgWin && bgWin.Lazarus && bgWin.Lazarus.Background && bgWin.Lazarus.Background.initialized){
        bgWin.Lazarus.onCallBackground.apply(Lazarus.getBackgroundWindow().Lazarus, [callbackInfo]);
      }
      else {
        //not ready yet, wait for the background window to be initialized
        setTimeout(function(){
          Lazarus.callBackground(funcName, args);
        }, 250);
      }
    }


    /**
    * handle a call background result
    **/
    Lazarus.onCallBackground = function(callbackInfo){
      //find the function to call
      if (Lazarus.logger){
        Lazarus.logger.log("on-call-background", callbackInfo);
      }
      
      var segments = callbackInfo.funcName.split(/\./g);
      var obj = window;
      //we need to save the context ("this" object) for when we call the function
      var context = window;
      while(segments.length > 0){
        context = obj;
        obj = obj[segments[0]];
        if (!obj){
          throw Error("onCallBackground: "+ callbackInfo.funcName +" ["+ segments[0] +"] is not a background object or function");
        }
        segments.shift();
      }
      
      //check to make sure it's a function we are calling
      if (typeof obj === "function"){
        //and call it
        obj.apply(context, callbackInfo.args);
      }
      else {
        throw Error("onCallBackground: "+ callbackInfo.funcName +" is not a background function");
      }
    }




    /**
    * opens a url in a new tab and focuses on said tab
    **/
    Lazarus.openURL = function(url){

      var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
                       .getService(Components.interfaces.nsIWindowMediator);  
      var mainWindow = wm.getMostRecentWindow("navigator:browser");  
      mainWindow.gBrowser.selectedTab = mainWindow.gBrowser.addTab(url);
    }


    /**
    * returns the contentWindow from our background iframe
    **/
    Lazarus.getBackgroundWindow = function(){
      //find the background window
      var win = Components.classes["@mozilla.org/appshell/appShellService;1"].getService(Components.interfaces.nsIAppShellService).hiddenDOMWindow;
      if (win.lazarusBackgroundWindow){
        return win.lazarusBackgroundWindow;
      }
      else {
        throw Error("Lazarus background iframe non initialized");
      }
    }



    /**
    * return an installed extension
    */
    Lazarus.getExtensionInfo = function(callback){
      
      //frak, we need our extension id :(
      var extId = Lazarus.extensionId;
      
      //Fx >= 4.0
      var AddonManager;
      try {
        AddonManager = Components.utils.import("resource://gre/modules/AddonManager.jsm").AddonManager;
      }catch(e){}
      
      if (AddonManager){
        AddonManager.getAddonByID(extId, function(addon){
          callback(addon);
        });
      }
      //Fx < 4.0
      else {
        var em = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
        var addon = em.getItemForID(extId);
        setTimeout(function(){
          callback(addon);
        }, 1);
      }
    }


    //return an array of browser (XUL) windows
    Lazarus.getBrowsers = function(){
      var wenum = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher).getWindowEnumerator();
      var found = [];
      while (wenum.hasMoreElements()) {
        found.push(wenum.getNext());
      }
      return found;
    }

    /*
    Updates the browser UI toolbar button 
    */
    Lazarus.updateToolbarButton = function(props){

      Lazarus.logger.log("updateToolbarButton", props);

      //initialise the button if it doesn't already exist
      if (!Lazarus.updateToolbarButton.toolbarButton){
        Lazarus.updateToolbarButton.toolbarButton = {};
        Lazarus.updateToolbarButton.onclick = function(evt){
          if (Lazarus.updateToolbarButton.toolbarButton.onclick && !Lazarus.updateToolbarButton.toolbarButton.disabled){
            Lazarus.updateToolbarButton.toolbarButton.onclick(evt);
          }
        }
      }
      
      //update properties
      for(var prop in props){
        Lazarus.updateToolbarButton.toolbarButton[prop] = props[prop];
      }
      
      var browsers = Lazarus.getBrowsers();
      for(var i=0; i<browsers.length; i++){
        var browser = browsers[i];
        var btn = browser.document.getElementById('lazarus-toolbar-button');
        if (btn){    
          // tooltip,
          if (props.tooltip){
            btn.setAttribute("tooltiptext", props.tooltip);
          }
          
          //disabled
          if (typeof props.disabled == "boolean"){
            btn.setAttribute("disabled", props.disabled ? "true" : "");
          }
          
          if (props.icon){
            //update the background image
            btn.style['listStyleImage'] = "url('"+ Lazarus.baseURI + props.icon +"')";
          }
        }
      }
    }


    Lazarus.fetchCurrentURL = function(callback){
      var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
      var mainWindow = wm.getMostRecentWindow("navigator:browser");
      var doc = mainWindow.gBrowser.contentDocument;
      var url = doc  ? doc.URL : null;
      callback(url);
    }


    Lazarus.addURLListener = function(listener){
      Lazarus.Event.addListener("FirefoxTabSelect", listener);
      Lazarus.Event.addListener("FirefoxDocumentReady", listener);
      Lazarus.Event.addListener("FirefoxBrowserActivate", listener);
    }
    
    /* Firefox needs to completely overwrite the database object */
    /* FIXME: This can be written a _lot_ better (see addon/cross-browser-code) */
    ns.Database = function(filepath, useSharedCache){
		
      var self = this;
      
      self.filepath = filepath;
      
      //are we allowed multiple connections to this database?
      self.useSharedCache = (typeof useSharedCache == "undefined") ? true : useSharedCache;
      
      //mozIStorageService
      self.storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
      
      //most recent SQL query
      self.lastQuery = null;
      
      //database connection
      self.connection = null;
      
      
      /**
      * close the connection to the database (this doesn't appear to work, the database file is still locked :()
      */
      self.close = function(){
        self.connection = null;
      }

      
      /**
      * executes a command (INSERT, UPDATE, CREATE, etc..) against the current database
      * returns an array of rows (if any)
      */
      self.exe = function(query, replacements, callback){
      
        //replacements is optional
        if (typeof replacements == "function"){
          callback = replacements;
          replacements = null;
        }
        
        self.transaction([query], [replacements], callback);
      }
      
      
      /**
      * execute a statement against the database
      * lowest level platform specific query, should return platform specific results
      **/
      self.runQuery = function(query, replacements, callback){
        //not used in Firefox 
      }
      
      
      /**
      * execute a series of queries wrapped in a single transaction
      **/
      self.transaction = function(queries, origReplacementsList, callback){
      
        //replacements is optional
        if (typeof origReplacementsList == "function"){
          callback = origReplacementsList;
          origReplacementsList = [];
        }
        
        self.connect();
        self.lastQuery = queries;
        Lazarus.logger.log("SQL:x"+ origReplacementsList.length +":"+ queries);
        
        //allow us to send a single query with a list of different replacements 
        //eg ("INSERT INTO x (name) VALUES ({name})", [{name:"arthur"}, {name:"ford"}, {name:"zaphod"}, {name:"trillian"}])
        if (typeof queries == "string"){
          queries = [queries];
          for(var i=1; i<origReplacementsList.length; i++){
            queries[i] = queries[0];
          }
        }
        
        //create the statements
        var statements = [];
        
        //make a copy of the original replacements so we don't alter it when 
        //we move from one statement to the next statement
        var replacementsList = Lazarus.Utils.clone(origReplacementsList);

        for(var i=0; i<queries.length; i++){
          var query = self.formatQuery(queries[i], replacementsList[i]);
          try {
            statements.push(self.connection.createStatement(query));
          }
          catch(e){
            Lazarus.logger.error("Unable to create statement, is there something wrong with the query?\n"+ query);
            callback(false, e);
            return;
          }
          queries[i] = query;
        }
        
        var statementsCallback = {
        
          error: null,
          
          rows: [],
          
          columns: [],
          
          //onsuccess
          //NOTE: this is not called for all statements, only those that return a result (eg SELECT)
          //NOTE: According to the documentation (https://developer.mozilla.org/en/mozIStorageStatementCallback) 
          //this may be called more than once for a given statement (at least that's how I read it)
          //<quote cite="https://developer.mozilla.org/en/mozIStorageStatementCallback" >
          //	Generally, this method will be called several times, each time providing one or more results.
          //</quote>
          //in practice it appears there is NO WAY to distinguish between result sets
          //if you call two select statement, and both return 10 results
          //handleResult may get called with 15 results and then 5 results!

          handleResult: function(resultSet){
            //one of the statements has returned a resultset.
            //we have no idea which statement in the transaction has called this result,
            //so we're going to store the rows in the rows array and when the transaction has finished 
            //we iterate through the rows and extract the correct values for each of the statements.
            while(rsRow = resultSet.getNextRow()){
              this.rows.push(rsRow);
            }
          },

          handleError: function(error){
            this.error = error;
          },

          handleCompletion: function(reason){
            
            if (reason == Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED){
              var elapsedTime = (new Date()).getTime() - startTime;
              Lazarus.logger.log("SQL: "+ this.rows.length +" row(s) returned in "+ elapsedTime +" ms");
              //we may have some results returned for some of the statements.
              //if so we need to figure out which result belongs with which statement.
              //AFAICT there is absolutely no way to tell which statement a given row matches
              //if there is then I can't find out where it's documented.
              //so instead we're only going to return the last results that match the last statement
              //all the other results can go and choke the guy who designed this.
              //all it needs is to have the mozIStorageStatement referenced from the mozIStorageRow
              //but no, that'd be way too frakking easy
              
              var statement = statements[statements.length -1];
                
              //convert the resultset into something we can actually use
              var columns = [];
              for (var i=0; i<statement.columnCount; i++){
                columns[i] = statement.getColumnName(i);
              }
                
              var dataSet = [];
              //now get the data for each of the rows
              //because we can't tell which statement this row matches
              //we're just going to go through them all and add the ones that match these columns
              //but we'll have to go through them backwards (in case a previous statement just happens to match the columns of this statement)
              for(var j=this.rows.length-1; j>=0; j--){
                var rsRow = this.rows[j];
                
                var row = {};					
                for (var i=0; i<columns.length; i++){
                  var column = columns[i];
                  try {
                    row[column] = rsRow.getResultByName(column);
                  }
                  catch(e){
                    //we've found a result that doesn't match the current statement
                    //time to exit
                    row = null;
                    break;
                  }
                }
                if (row){
                  dataSet.unshift(row);
                }
                else {
                  break;
                }
              }
              
              //if there are multiple transactions with results explain how many are relevant
              if (this.rows.length != dataSet.length){
                Lazarus.logger.log("SQL: "+ dataSet.length +" row(s) match the last statement");
              }
              //Lazarus.logger.dump(dataSet)
              if (queries.length > 1){
                Lazarus.Event.fire('databaseTransaction', queries);
              }
              else {
                Lazarus.Event.fire('databaseExecute', queries[0]);
              }
              callback(dataSet);
            }
            else {
              Lazarus.logger.error("SQL ERROR: "+ this.error);
              callback(null, this.error);
            }
          }
        }
        
        var startTime = (new Date()).getTime();
        Lazarus.logger.log("SQL: "+ queries.join("\n"));
        self.connection.executeAsync(statements, statements.length, statementsCallback);
      }
      
      
      /**
      * return a query that is safe to run
      */
      self.formatQuery = function(query, replacements){
        //don't re-format queries passed twice
        if (!replacements){
          return query;
        }
        
        return query.replace(/\{\w+\}/g, function(m){
          var key = m.replace(/\{|\}/g, '');
          if (typeof replacements[key] == "number"){
            return replacements[key];
          }
          else if (replacements[key] === null){
            return "NULL";
          }
          else if (typeof replacements[key] != "undefined"){
            return ("'"+ replacements[key].toString().replace(/'/g, "''") +"'");
          }
          else {
            Lazarus.logger.error("formatQuery: missing replacement in query", query, replacements);
            throw Error("formatQuery: missing replacement in query");
          }
        });
      }
      
      
      /**
      * execute an INSERT statement and return the last_insert_rowid 
      */
      self.insert = function(query, replacements, callback, errorHandler){
        
        //replacements is optional
        if (typeof replacements == "function"){
          errorHandler = callback;
          callback = replacements;
          replacements = null;
        }
        
        var queries = [];
        queries.push(self.formatQuery(query, replacements));
        queries.push("SELECT last_insert_rowid() as id");
        self.transaction(queries, function(rs){
          if (rs){
            callback(rs[0]["id"]);
          }
          else {
            callback(null);
          }
        });
      }
      
      
      /**
      * return a single row of results as an associate array (js object)
      */
      self.getObj = function(query, replacements, callback){
        
        //replacements is optional
        if (typeof replacements == "function"){
          callback = replacements;
          replacements = null;
        }
        
        self.exe(query, replacements, function(rs){
          if (rs && rs[0]){
            callback(rs[0]);
          }
          else {
            callback(null);
          }
        });
      }
      
      
      /**
      * returns a single STRING result from a query.
      */
      self.getStr = function(query, replacements, callback){
        
        //replacements is optional
        if (typeof replacements == "function"){
          callback = replacements;
          replacements = null;
        }
      
        self.exe(query, replacements, function(rs){
          if (rs && rs.length > 0){
            for(var col in rs[0]){
              var val = rs[0][col].toString();
              callback(val);
              return;
            }
            //we should never get here
            //there should always be at least one property for the object, but if not then throw an error
            throw Error("SQL: getStr: failed to return an object");
          }
          else {
            //no results 
            callback("");
          }
        });
      }
      
      /**
      * returns a single INTEGER result from a query.
      */
      self.getInt = function(query, replacements, callback){
        
        //replacements is optional
        if (typeof replacements == "function"){
          callback = replacements;
          replacements = null;
        }
        
        self.getStr(query, replacements, function(result){
          var val = parseInt(result);
          callback(isNaN(val) ? 0 : val);
        });		
      }
      
      
      
      self.getColumn = function(query, replacements, callback){
        //replacements is optional
        if (typeof replacements == "function"){
          callback = replacements;
          replacements = null;
        }
        
        self.exe(query, replacements, function(rs){
          var fields = [];
          if (rs){        
            for(var i=0; i<rs.length; i++){
              for(var field in rs[i]){
                fields.push(rs[i][field]);
                break;
              }
            }
          }
          callback(fields);
        });	
      }
      
      
      /**
      * return TRUE if table exists in the current database
      */
      self.tableExists = function(name, callback){
        var query = "SELECT count(*) FROM sqlite_master WHERE name = {name}";
        self.getInt(query, {name:name}, function(result){
          var val = parseInt(result);
          callback(val > 0);
        });	
      }
      
      
      /**
      * opens a connection to the specified SQLite database 
      */
      self.connect = function(){
        self.error = null;
        
        if (!self.connection){
          try {
            //allow for files to be relative to the profile directory
            if (self.filepath.indexOf("%profile%") == 0){
              var dir = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile).path;
              self.filepath = self.filepath.replace("%profile%", dir);
              if (dir.indexOf("/") > -1){
                self.filepath = self.filepath.replace(/\\/g, "/");
              }
              else {
                self.filepath = self.filepath.replace(/\//g, "\\");
              }   
            }
            
            var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
            file.initWithPath(self.filepath);
            if (self.useSharedCache){
              self.connection = self.storageService.openDatabase(file);
            }
            else {
              self.connection = self.storageService.openUnsharedDatabase(file);
            }
          }
          catch(err){
            //add some better info to the error message
            throw Error("SQLite: failed to open database\n'"+ self.filepath +"'\n"+ err.message);
          }
        }
      }
    }
    
    
    
    ns.platform.isPrivateBrowsingEnabled = function(){
      var pbs = Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService);
      return pbs.privateBrowsingEnabled;
    }
  }
  

})(Lazarus)