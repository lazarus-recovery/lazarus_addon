


function debug(){
    var msg = "";
    for (var i=0; i<arguments.length; i++){
        msg += debug.debugString(arguments[i]) +"\n";
    }
    try {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage(msg);
    }
    catch(e){
        alert(msg)
    }
}

debug.MAX_DEPTH = 3;

debug.debugString = function(arg, depth){
    
    var undefined;
    
    switch (arg){
    case null:  return "[null]";
    case "":    return "[empty string]";
    case true:  return "[true]";
    case false: return "[false]";
    case undefined: return "[undefined]";
    default:
        var msg = "";
        var type = typeof(arg);
        
        if (type == "function"){
            //just grab the first line of the function
            msg += arg.toString().split(/\n/)[0].replace(/\{/, '');
            break;
        }
        else if (type == "string"){
            msg += '[string:'+ arg.length +'] '+ arg;
        }
        else if (type == "object" && typeof arg.length === 'number' && arg.propertyIsEnumerable && !arg.propertyIsEnumerable('length')){
            msg += "[array:"+ arg.length +"]\n"; 
            depth = depth || 0;
            if (depth < debug.MAX_DEPTH){
                var tabs ="\t";
                for (var i=0; i<depth; i++){
                    tabs +="\t";
                }
                
                for (var i=0; i<arg.length; i++){
                    msg += tabs +"["+ i +"]="+ debug.debugString(arg[i], depth+1) +"\n";
                }
            }
        }
        else if (arg.nodeType && arg.nodeType == 9){
            msg += "[DOMDocument] "+ arg.URL;
        }
        else if (type == "object"){
            switch(arg.nodeType){
                case 9:
                    return "[HTMLDocument] "+ arg.URL;
                    
                case 1:
                    msg = "[HTMLElement] "+ arg.nodeName;
                    msg += arg.id ? (" #"+ arg.id) : '';
                    msg += arg.className ? (" ."+ arg.className) : '';
                    msg += arg.href ? (" href="+ arg.href) : '';
                    return msg;
            }
            
            msg += "[object]\n";
            depth = depth || 0;
            if (depth < debug.MAX_DEPTH){
                var tabs ="\t";
                for (var i=0; i<depth; i++){
                    tabs +="\t";
                }
                
                for (var prop in arg){
                    try {
                        msg += tabs + prop +"="+ debug.debugString(arg[prop], depth+1) +"\n";
                    }
                    catch(e){
                        msg += tabs + prop +"=?\n"; 
                    }
                }
            }
        }
        else {
            try {
                msg += arg +" ["+ type +"]";
            }
            catch(e){
                msg += "?"+" ["+ type +"]";
            }
        }
    }
    return msg;
}

debug.test = function(){
    debug({
        "int": 0,
        "string": "a long string",
        "function": function(){},
        "null": null,
        "true": true,
        "false": false,
        "error": Error("just an error"),
        "array": [1,2,3],
        "object": {
            "x": 123,
            "y": 456
        },
        "more stuff": "cheddar",
        "how deep" : {
            "level 1": {
                "level 2": {
                    "level 3": {
                    }
                }
            }
        },
        "empty string": ""
    });
}

/**
* open the javascript console
*/
debug.openJSConsole = function(){
    window.open("chrome://global/content/console.xul", "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
}

/**
* sends a message to the Javascript Console
*/
debug.consoleMsg = function(str){
    Components.utils.reportError(str);
}


var Profiler = function(title){
    
    //name of this instance
    this.title = title || '';
    
    /**
    * return the current epoc in seconds
    */
    this.timestamp = function(){
        return new Date().getTime() / 1000;
    }
    
    //start time
    this.startTime = this.timestamp();
    
    //array of points marked by code
    this.log = [];
    
    /**
    * mark a point in the code
    */
    this.mark = function(title){
        this.log.push({
            "title": title,
            "time": this.timestamp()
        })    
    }
    
    /**
    * stops the profiler and returns the profiler log as a string
    */
    this.stop = function(title){
        this.mark(title);
        var msg = this.title +"\n";
        var lastTime = this.startTime;
        for (var i=0; i<this.log.length; i++){
            var item = this.log[i];
            var elapsed = item.time - lastTime;
            lastTime = item.time;
            msg += this.fix(elapsed, 3, true) +": "+  item.title +"\n";
            if (i == this.log.length -1){
                msg += "total time "+ this.fix(item.time - this.startTime, 3, true) +" seconds";
            }
        }
        
        return msg;
    }
    
    /**
    * formats a number to the given decimal places
    */
    this.fix = function(num, dp, returnAsPaddedString){
        dp = dp || 0;
        
        var mult = Math.pow(10, dp);
        num = (Math.round(num * mult) / mult);
        
        if (returnAsPaddedString){
            //make sure num is a string
            var numStr = ""+ num;
            var bits = numStr.split(/\./, 2);
            bits[1] = bits[1] || '';

            for (var i=bits[1].length; i<dp; i++){
                bits[1] += '0';
            }

            return bits.join('.');
        }
        else {
            return num;
        }
    }
}
