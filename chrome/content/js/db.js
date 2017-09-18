


(function(ns){
  ns.Database = function(filename, version, name, size){

    var self = this;
		
		//most recent SQL query
		self.lastQuery = null;
    
		//database connection
    self.connection = openDatabase(filename, version, name, size);
     
		 
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
			
			self.runQuery(query, replacements, function(sqlTrans, sqlRs){
        //checking for errors
        if (sqlTrans !== false){
          var rs = self.SQLResultSetToArray(sqlRs);
          callback(rs);
        }
        else {
          callback(false, sqlTrans, sqlRs);
        }
			});
    }
    
		
		
		/**
		* execute a statement against the database
		* lowest level platform specific query, should return platform specific results
		**/
		self.runQuery = function(query, replacements, callback){
		
			//replacements is optional
			if (typeof replacements == "function"){
				callback = replacements;
				replacements = null;
			}
			
      //and execute the query
			if (replacements){
				query = self.formatQuery(query, replacements);
			}
			
			self.lastQuery = query;
			Lazarus.logger.log("SQL: "+ query);
			var st = (new Date()).getTime();
			
      self.connection.transaction(function(transaction){
        transaction.executeSql(query, [], function(sqlTrans, sqlRs){
					var el = (new Date()).getTime() - st;
					Lazarus.logger.log("SQL: "+ el +"ms");
          Lazarus.Event.fire('databaseExecute', query);
					callback(sqlTrans, sqlRs);
				}, function(sqlTrans, sqlError){
          //error handler
          Lazarus.logger.error("SQL ERROR: "+ query, sqlTrans, sqlError);
          callback(false, sqlTrans, sqlError);
        });
      });
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
			
			//build the list of queries to run
			var results = [];
			
      //and execute the query
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
      
			//make a copy of the original replacements so we don't alter it when 
			//we move from one statement to the next statement
			var replacementsList = Lazarus.Utils.clone(origReplacementsList);
			
			var st = (new Date()).getTime();
      var completedQueries = [];
      var currentQuery = '';
			
			//all the queries should be wrapped in a single transaction
      self.connection.transaction(function(transaction){
				
        
				var runNextQuery = function(){				
					var replacements = replacementsList.shift();
					var query = self.formatQuery(queries.shift(), replacements);
					Lazarus.logger.log(query);
          currentQuery = query;
					transaction.executeSql(query, [], function(sqlTrans, sqlRs){
						results.push({
							trans: sqlTrans,
							result: sqlRs
						});
            completedQueries.push(query);
						if (queries.length > 0){
							runNextQuery();
						}
						else {
							//finished all queries
							var el = (new Date()).getTime() - st;
							Lazarus.logger.log("SQL: "+ el +"ms");
              Lazarus.Event.fire('databaseTransaction', completedQueries);
							callback(results);
						}
					}, function(sqlTrans, sqlError){
            //error handler
            //attempt to rollback the transaction
            Lazarus.logger.error("SQL TRANSACTION ERROR: "+ currentQuery, sqlTrans, sqlError);
            callback(false, results, sqlTrans, sqlError);
          });
				}
        //now start
				runNextQuery();
      });
		};
		
		
		/**
		* return a query that is safe to run
		*/
		self.formatQuery = function(query, replacements){
      //dont re-format queries passed twice
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
		self.insert = function(query, replacements, callback){
			
			//replacements is optional
			if (typeof replacements == "function"){
				callback = replacements;
				replacements = null;
			}
			
			self.runQuery(query, replacements, function(sqlTr, sqlRs){
        callback(sqlRs.insertId || null);
      }, function(){
				callback(null);
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
		* convert a resultset into a simple array of objects
		**/
    self.SQLResultSetToArray = function(resultSet){
			var arr = [];
      if (resultSet && resultSet.rows){
        for(var i=0; i<resultSet.rows.length; i++){
          //FFS: cannot just copy the object, it becomes read only, and properties cannot be changed!
          //arr[i] = resultSet.rows.item(i);
          //arr[i].summary = "overwritten"; 
          //FAILS TO OVERWRITE arr[i].summary
          //using clone instead.
          arr[i] = Lazarus.Utils.clone(resultSet.rows.item(i));
        } 
      }
			return arr;
    }
  }

})(Lazarus);
