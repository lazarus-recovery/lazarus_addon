

/**
* SQLite object for mozilla

== example usage ==

var db = new SQLite("%profile%/test.sqlite");

var rs = db.rs("SELECT * FROM USERS WHERE id = ?1", 124);

if (!db.error){
  for (var i=0; i<rs.length; i++){
    ...do something with recordset
  }
}
else {
  ...show error message
}


*/

//http://textsnippets.com/posts/show/1030#related
Lazarus.SQLite = function(filepath, useSharedCache){
  
  var _this = this;
	
	//set to true to log all queries to the error console
	_this.debugging = false;
  
  _this.filepath = filepath;
  
  //are we allowed multiple connetcions to this database?
  _this.useSharedCache = (typeof useSharedCache == "undefined") ? true : useSharedCache;
  
  //mozIStorageService
  _this.storageService = Components.classes["@mozilla.org/storage/service;1"].getService(Components.interfaces.mozIStorageService);
  
  //database connection
  _this.conn = null;
  
  //any error object will be placed here.
  _this.lastError = null;
  
  //most recent SQL query
  _this.lastQuery = null;
  
  //array of argument to be passed to the sql query
  _this.lastQueryArgs = null;
  
  /**
  * opens a connection to the specified SQLite database 
  */
  _this.connect = function(){
    _this.error = null;
    
    if (!_this.conn){
      try {
        //allow for files to be relative to the profile directory
        if (_this.filepath.indexOf("%profile%") == 0){
          var dir = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile).path;
          _this.filepath = _this.filepath.replace("%profile%", dir);
          if (dir.indexOf("/") > -1){
            _this.filepath = _this.filepath.replace(/\\/g, "/");
          }
          else {
            _this.filepath = _this.filepath.replace(/\//g, "\\");
          }   
        }
        
        var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
        file.initWithPath(_this.filepath);
        if (_this.useSharedCache){
          _this.conn = _this.storageService. openDatabase(file);
        }
        else {
          _this.conn = _this.storageService. openUnsharedDatabase(file);
        }
      }
      catch(err){
        //add some better info to the error message
        throw Error("SQLite: failed to open database\n'"+ _this.filepath +"'\n"+ err.message);
      }
    }
  }
  
  /**
  * close the connection to the database (this doesn't appear to work)
  */
  _this.close = function(){
    _this.conn = null;
  }
  
	/*
	log a message to the error console
	*/
	_this.log = function(msg){
		if (_this.debugging){
			_this.consoleService = _this.consoleService || Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
			_this.consoleService.logStringMessage("SQLite: "+ msg);
		}
  }
		
	
  /**
  * sends an error to the error console
  * but allows code to contnue
  */
  _this.logError = function(err){
  
    if (typeof err == "string"){
      //generate a better error message
      err = new Error("SQLite Error: "+ err);
    }
    
    //add some more info to the error
    if (_this.lastQuery){
      //WTF: cannot append data to the err.message!
      //err.message += "\nSQL = '"+ _this.lastQuery.query +"'";
      //we'll throw an error now with the needed info
      Components.utils.reportError("SQLite.lastQuery = '"+ _this.lastQuery.query +"'");
    }
    _this.lastError = err;
  }
  
  /**
  * Adds some SQL specific info and then throws the error 
  */
  _this.throwError = function(err){
    _this.logError(err);
    throw _this.lastError;
  }
  
  /**
  * return the final formatted query
  */
  _this.getQuery = function(queryObj){
    var q = queryObj.query;
    for (var i=0; i<queryObj.args.length; i++){
      q = q.replace(/\?\d/, "'"+ queryObj.args[i].toString().replace(/'/, "\\'") +"'");
    }
    return q;
  }
  
  /**
  * executes an sql query against the current database
  */
  _this.runQuery = function(queryObj){
	
		var startTime = (new Date()).getTime();
		
		var q = (typeof queryObj == "string") ? queryObj : queryObj[0];
		_this.log(q);
		
    //pass a string (+ replacements args)
    if (typeof queryObj == "string"){
      queryObj = _this.queryFromArguments(arguments);
    }
    //or an arguments object that contains a string (+ replacements args)
    else if (typeof queryObj.length == "number"){
      queryObj = _this.queryFromArguments(queryObj);
    }
  
    _this.lastQuery = queryObj;
    _this.lastError = null;
    
    _this.connect();
    //make copies of the query and args 
    //so we can add them to error messages
    
    var defer = false;
		
    //use deferred transaction if database is currently busy
    if (_this.conn.transactionInProgress){
			defer = true;
			_this.conn.beginTransactionAs(_this.conn.TRANSACTION_DEFERRED);
		}
    
		//build the statement
    try {
      var statement = _this.conn.createStatement(queryObj.query);
      if (queryObj.args){
        for (var i=0; i<queryObj.args.length; i++){
          var arg = queryObj.args[i].toString();
          statement.bindUTF8StringParameter(i, arg);
        }
      }
    
      //SELECT statements use executeStep()
      //but all others use execute.
      //no we can use executeStep() even on a NON select statement.
      // ref: http://developer.mozilla.org/en/docs/Storage  
      var dataset = [];
      var columns = null;
      while (statement.executeStep()){
        var row = {};
        //we need to calculate the types of each column
        //do not use statement.columnCount in the for loop, fetches the value again and again
        var cols = statement.columnCount;
        if (columns === null){
          columns = [];
          for (var i=0; i<cols; i++){
            columns[i] = {
              "type": statement.getTypeOfIndex(i), //0=null, 1=int, 2=float, 3=string, 4=blob
              "name": statement.getColumnName(i)
            };
          }
        }
        
        //keep a copy of the columns
        _this.lastQuery.columns = columns;
        
        for (var i=0; i<cols; i++){
          var val;
          switch (columns[i].type){
            case 0: //null
              val = null;
              break;
            case 1: //int
              val = statement.getInt64(i);
              break;
            case 2: //float
              val = statement.getDouble(i);
              break
            case 3: //string
              val = statement.getUTF8String(i);
              break;
            case 4: //blob
            default:
              _this.logError("Unable to handle datatype "+ columns[i].type);
              val = null;              
          }
          row[columns[i].name] = val;
        }
        
        dataset.push(row);
      }
    }
    catch(err){
      _this.logError(err);
    }
    finally {
        //must make sure statement is reset
        statement.reset();
    }
        
    
    //commit delayed transaction
		if (defer){
			_this.conn.commitTransaction();
		}
		
		var endTime = (new Date()).getTime();
		_this.log((endTime - startTime) +"ms: "+ q); 
		
    //if there was an error we should throw it now that the statement has been reset
    if (_this.lastError){
      throw _this.lastError;
    }
    //otherwise return any dataset
    return dataset;
  }
  
  /**
  * convert an arguments object into a query object
  */
  _this.queryFromArguments = function(argObj){
    
    var query = {
      "query": argObj[0],
      "args" : []
    }
    for (var i=1; i<argObj.length; i++){
      query.args.push(argObj[i]);
    }
    return query;    
  }
  
  /**
  * executes a command (INSERT, UPDATE, CREATE, etc..) against the current database
  */
  _this.exe = function(query, arg1 /*, arg2, arg3...*/){
    _this.runQuery(arguments);
    return true;
  }
	
	
	/**
  * executes an asyncronous command (INSERT, UPDATE, CREATE, SELECT, etc..) against the current database
  */
  _this.exeAsync = function(query, replacements, callback){
		
		replacements = replacements || [];
		callback = callback || function(){};
		//
		var queries = [query];
		var replacements = [replacements];
		
		_this.connect();
		
		//create the statements
		var statements = [];
		//allow us to send a single query with a list of different replacements 
		//eg ("INSERT INTO x (name) VALUES ({name})", [{name:"arthur"}, {name:"ford"}, {name:"zaphod"}, {name:"trillian"}])
		
		for(var i=0; i<queries.length; i++){
			try {
				var statement = _this.conn.createStatement(query);
			}
			catch(e){
				Lazarus.error("Unable to create statement, is there something wrong with the query?\n"+ query);
				throw e;
			}
			var args = replacements[i];
			
			if (args && args.length){
        for (var i=0; i<args.length; i++){
          var arg = args[i].toString();
          statement.bindUTF8StringParameter(i, arg);
        }
      }
			statements.push(statement);
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
			//if you call two select statements and both return 10 results
			//handleResult may get called with 15 results and then 5 results!
			//this is not a problem here because we're only going to be calling one statement at a time
			handleResult: function(resultSet){
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
					
					_this.log("SQL: "+ this.rows.length +" row(s) returned in "+ elapsedTime +" ms");
					//we may have some results returned for some of the statements.
					//if so we need to figure out which result belongs with which statement.
					//AFAICT there is absolutely no way to tell which statement a given row matches
					//if there is then I can't find out where it's documented.
					//so instead we're only goinf to return the last results that match the last statement
					//all the other results can go and choke the guy who designed this.
					//all it needs is to have the mozIStorageStatement referenced from the mozIStorageRow
					//but no, that'd be too easy
						
					//convert the resultset into something we can actually use
					var statement = statements[statements.length -1];
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
						_this.log("SQL: "+ dataSet.length +" row(s) match the last statement");
					}
					//Lazarus.logger.dump(dataSet)
					callback(dataSet);
				}
				else {
					_this.log("SQL: error: "+ this.error);
					callback(null, this.error);
				}
			}
		}
		
		var startTime = (new Date()).getTime();
		_this.log("SQL: "+ queries.join("\n"));
		_this.conn.executeAsync(statements, statements.length, statementsCallback);
		
  }
	
	
  
  /**
  * execute an INSERT statement and return the last_insert_rowid 
  */
  _this.insert = function(){
    _this.runQuery("BEGIN TRANSACTION");
    _this.runQuery(arguments);
    var id = _this.getInt("SELECT last_insert_rowid()");
    _this.runQuery("COMMIT TRANSACTION");
    return id;
  }
  
  /**
  * runs a SELECT statement and returns a recordset 
  * will return an empty array if no matches are found  
  */
  _this.rs = function(query, arg1 /*, arg2, arg3...*/){
    return _this.runQuery(arguments);
  }
  
  /**
  * return a single column of results as an array
  */
  _this.getColumn = function(query, arg1 /*, arg2, arg3...*/){
    var rs = _this.runQuery(arguments);
    var column = [];
    for (var i=0; i<rs.length; i++){
      for(var key in rs[i]){
        if (typeof column[i] == "undefined"){
          column[i] = rs[i][key];
        }
        else {
          _this.throwError("Too many columns, getColumn expects the dataset to contain 1 and only 1 column");
        }
      }
    }
    return column;
  }
  
  /**
  * return a single row of results as an associate array (js object)
  */
  _this.getRow = function(query, arg1 /*, arg2, arg3...*/){
    var rs = _this.runQuery(arguments);
    return (rs[0]) ? rs[0] : null;
  }
  
  
  /**
  * returns a single INTEGER result from a query.
  * NOTE: the function expects the query to return a single value, if the query returns a more then one row
  * or more than one column the we will throw an error   
  */
  _this.getInt = function(query, arg1 /*, arg2, arg3...*/){
    var rs = _this.runQuery(arguments);
    if (rs.length == 0){
      //no results 
      return 0;
    }
    else {
      for(var col in rs[0]){
        var val = parseInt(rs[0][col]);
        return (val === NaN) ? 0 : val;
      }
    }
    //should get here
    return null;
  }
  
  /**
  * returns a single STRING result from a query.
  * NOTE: the function expects the query to return a single value, if the query returns a more then one row
  * or more than one column the we will throw an error   
  */
  _this.getStr = function(query, arg1 /*, arg2, arg3...*/){
    var rs = _this.runQuery(arguments);
    if (rs.length == 0){
      //no results 
      return '';
    }
    else {
      for(var col in rs[0]){
        return rs[0][col];
      }
    }
    //should not get here
    return null;
  }
  
  /**
  * return TRUE if table exists in the current database
  */
  _this.tableExists = function(name){
    return (_this.getInt("SELECT count(*) FROM sqlite_master WHERE name = ?1", name) > 0) ? true : false;
  }
}

