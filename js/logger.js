/*

Usage 

ns.logger = new ns.Logger("{namespace}", ns.Logger.LOG_LEVEL_MESSAGES);

*/

(function(ns){

  var isFirefox = typeof InstallTrigger !== 'undefined';
  var isChrome = !!(window.chrome);
  var isSafari = !!(window.safari);

	// == Public ==
	
	ns.Logger = function(prefix, logLevel){
  
		//string prepended to every message (to make filtering easier)
		this.prefix = prefix || '';
		
		//set default logging level
		this.logLevel = logLevel ? logLevel : 2;
    
    //chrome allows us to bind our log messages directly to the real console object
		
    if (window.console && window.console.log && typeof window.console.log.bind == "function"){
      
      prefix = prefix || '';

      this.log = function(){};
      this.warn = function(){};
      this.error = function(){};
      
      switch(this.logLevel){
        //NOTE: case statements are supposed to cascade here, as each level just leaves one more method as a no-op
        case ns.Logger.LOG_LEVEL_MESSAGES:
          this.log = console.log.bind(console, prefix);          
        case ns.Logger.LOG_LEVEL_WARNINGS:
          this.warn = console.warn.bind(console, prefix);    
        case ns.Logger.LOG_LEVEL_ERRORS:
          this.error = console.error.bind(console, prefix);    
        case ns.Logger.LOG_LEVEL_NONE:
          //do nothing, all logging is already disabled
        break;
        
        default:
          throw Error("Attempting to set an unknown log level '"+ this.logLevel +"'");
        break;
      }
    }
    //fall back to using apply to call the console methods
    else {
      this.error = function(){
        this.logMessage(arguments, "error", ns.Logger.LOG_LEVEL_ERRORS);
      }
      
      this.warn = function(){
        this.logMessage(arguments, "warn", ns.Logger.LOG_LEVEL_WARNINGS);
      }
      
      this.log = function(){
        this.logMessage(arguments, "log", ns.Logger.LOG_LEVEL_MESSAGES);
      }
    }
		
		this.formatObject = function(obj, depth){
			var MAX_DEPTH = 5;
			depth = depth || 0;
			if (depth >= MAX_DEPTH){
				return "...";
			}
			
			var undefined;
			
			switch(typeof obj){
				case "string":
					return '"'+ obj +'"';
				case "number":
				case "boolean":
					return "["+ typeof obj +"] "+ obj;
				case "function":
					return obj.toString().replace(/\n(\w\W)*/, '');
				
				default:
					switch(obj){
						case null:
							return "[null]";
						case undefined:
							return "[undefined]";
						default:
							var tabs = "";
							for(var i=0; i<depth; i++){
								tabs += "\t";
							}
							//array
							if (Object.prototype.toString.call(obj) === '[object Array]'){
								var str = "[array "+ obj.length +"][\n";
								for (var i=0; i<obj.length; i++){
									str += tabs +"\t["+ i +"] "+ this.formatObject(obj[i], depth+1) +"\n";
								}
								str += tabs +"]";
								return str;
							}
							//or object
							else {
								var str = "[object] {\n";
								for(var prop in obj){
									str += tabs +"\t"+ prop +"=";
									try {
										str += this.formatObject(obj[prop], depth+1);
									}
									catch(e){
										str += "?";
									}
									str += "\n";
								}
								str += tabs +"}";
								return str;
							}
						break;
					}
				break;
			}
		}
		
		//dump a  string representation of the object to the log 
		this.dump = function(obj){
			this.log(this.formatObject(obj));
		}
		
		this.logMessage = function(args, type, minLevel){
			if (this.logLevel >= minLevel){
				args = argsToArray(args);
				
				if (this.prefix){
					args.unshift(this.prefix);
				}
				
				if (window.console && console[type] && console[type].apply){
					console[type].apply(console, args);
				}
				//IE 8 developer tools
				else if (window.console && console[type]){
					console[type](args.join("\n"));
				}
			}
		}
		
		this.test = function(){
			this.dump({
				str0: "",
				str1: "hello",
				bool0: false,
				bool1: true,
				int0: 0,
				int1: 1,
				null0: null,
				array0: [],
				array1: [1,2,3],
				obj0: {},
				obj1: {
					prop1: "prop1"
				}
			});
		}
	}
	
	ns.Logger.LOG_LEVEL_NONE = 1;
	ns.Logger.LOG_LEVEL_ERRORS = 2;
	ns.Logger.LOG_LEVEL_WARNINGS = 3;
	ns.Logger.LOG_LEVEL_MESSAGES = 4;
	
	// == Private ==	
	
	/**
	* return TRUE if object is an error object
	**/
	function isError(obj){
		//because (obj instanceof Error) doesn't always work
		return (obj && obj.stack && obj.message);
	}
	
	/**
	* convert an arguments object into an array
	**/
	function argsToArray(args){
		var found = [];
		for(var i=0; i<args.length; i++){
			found.push(args[i]);
		}
		return found;
	}
	
})(Lazarus);

