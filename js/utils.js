
(function(){

	var Utils = Lazarus.Utils = {
	
		isArray: function(obj){
			return Object.prototype.toString.call(obj) === '[object Array]';
		},
	
		addEvent: function(ele, evtName, func, captureEventPhase){
			captureEventPhase = captureEventPhase || false;
			ele.addEventListener(evtName, func, captureEventPhase);
		},
		
		removeEvent: function(ele, evtName, func, captureEventPhase){
			captureEventPhase = captureEventPhase || false;
			ele.removeEventListener(evtName, func, captureEventPhase);
		},
		
		/**
    * return a unique identifier (string)
    */
    guid: function(){
      return ((new Date().getTime()) +"-"+ Math.random()).replace(".", "");
    },
		
		trim: function(str){
      return str.replace(/^[\r\n\s]+/, '').replace(/[\r\n\s]+$/, '');
    },
		
		sendMessage: function(win, obj, domain){
			win.postMessage(JSON.stringify(obj), domain || '*');
		},
		
		addMessageListener: function(win, func){
			win.addEventListener("message", function(evt){
				func(JSON.parse(evt.data), evt);
			}, false);
		},
		
		clone: function(obj){
			
			switch(typeof obj){
				//don't clone functions or undefined variables
				case "undefined":
				case "function":
					return;
					
				case "boolean":
				case "number":
				case "string":
					return obj;
          
				case "object":
					if (obj === null){
						return null;
					}
					else if (Utils.isArray(obj)){
						var newArr = [];
						for(var i=0; i<obj.length; i++){
							newArr[i] = this.clone(obj[i]);
						}
						return newArr;
					}
					else {
						var newObj = {};
						for(var prop in obj){
							newObj[prop] = this.clone(obj[prop]);
						}
						return newObj;
					}
					
				default:
					throw Error("clone: unknown data type '"+ typeof obj +"'");
          
      }
    },
		
		timestamp: function(includeMs){
			var s = (new Date()).getTime() / 1000;
			return includeMs ? s : Math.floor(s);
		},
    
    microtime: function(){
			return (new Date()).getTime();
		},
		
		insertAfter: function(ele, newNode){
			ele.parentNode.insertBefore(newNode, ele.nextSibling);
		},
		
		
		findParent: function(ele, searchFunc){
      if (typeof searchFunc == "string"){
        var nodeName = searchFunc.toLowerCase();
        searchFunc = function(ele){
          if (ele.nodeName.toLowerCase() == nodeName){
            return ele;
          }
          else {
            return null;
          }
        }
      }
      
			while(ele && ele.nodeName){
        var result = searchFunc(ele);
        if (result){
          return result;
        }
        else {
          ele = ele.parentNode;
        }
			}
			return null;
		},
    
    
    findChildren: function(parent, tagName, searchFunc){
      if (typeof searchFunc == "string"){
        var className = searchFunc.toLowerCase();
        searchFunc = function(ele){
          return Utils.hasClass(ele, className) ? ele : null;
        }
      }
      var eles = parent.getElementsByTagName(tagName);
      var found = [];
      if (eles){
        for(var i=0; i<eles.length; i++){
          var ele = eles[i];
          if (searchFunc(ele)){
            found.push(ele);
          }
        }
      }
      return found;
    },
    
    
    hasClass: function(ele, classname){
      var cls = (ele && (typeof ele.className == "string")) ? ele.className : "";
      var classes = cls.toLowerCase().split(/\s+/);
      var lowerClassName = classname.toLowerCase();
      for(var i=0; i<classes.length; i++){
        if (classes[i] == lowerClassName){
          return true;
        }
      }
      return false;
    },
		
		inArray: function(val, arr){
			for(var i=0; i<arr.length; i++){
			  if (arr[i] == val){
					return true;
				}
			}
			return false;
		},
    
    
    injectCode: function(doc, code){
      var script = doc.createElement('script');
      script.type = "text/javascript";
      script.appendChild(doc.createTextNode(code));
      doc.documentElement.appendChild(script);
    },
    
    
    
		
		/***
		* return TRUE if value is set (this includes if value == "" or value == 0, but not if value === null or undefined)
		***/
		isSet: function(val){
			return (typeof val !== "undefined") && (val !== null);
		},
		
		/**
		* calls an array of asynchronous functions and then calls callback when they have all finished
		* functions are called in series, the second function waiting for the first function to finish before being called
		* NOTE: the last argument of ALL the functions must be the callback and should be left out of the arguments array (if that makes sense)
		* NOTE: fns should return only one parameter to it's callback with the results of the asynchronous function
		* IMPORTANT: args should be an array of arrays where the internal arrays are the arguments to pass to an individual function
    **/
		callAsyncs: function(fns, args, finalCallback){
			//allow a single function to be called multiple times with different arguments
			if (typeof fns == "function"){
				var origFn = fns;
				fns = [];
				for(var i=0; i<args.length; i++){
					fns.push(origFn);	
				}
			}
			
			var results = [];
			
			var callNextFunc = function(){
				if (fns.length){
					var fn = fns.shift();
					var fnArgs = args.shift();
					//add a callback to this functions arguments
					fnArgs.push(function(result){
            //the callback saves the results from the function call
						results.push(result);
            //and then calls the next function in the queue
						callNextFunc();
					});
					fn.apply(fn, fnArgs);
				}
				else {
					finalCallback(results);
				}
			}
      
      
			callNextFunc();
		},
    
    
    jsToCSSStyleName: function(jsStyle){
      return jsStyle.replace(/([A-Z])/g, function(m){
        return '-'+ m.toLowerCase();
      });
    },
    
    getStyle: function(ele, style){
      return ele.style[style];
    },
    
    setStyle: function(ele, style, value){
      ele.origStyle = ele.origStyle || {};
      if (typeof ele.origStyle[style] === "undefined"){
        ele.origStyle[style] = ele.ownerDocument.defaultView.getComputedStyle(ele, null).getPropertyValue(Utils.jsToCSSStyleName(style));
      }
      if (ele.style[style] != value){
        ele.style[style] = value;
      }
    },
    
    restoreStyle: function(ele, style){
      //restore all saved styles 
      if (ele.origStyle){
        if (arguments.length === 1){
          for(var key in ele.origStyle){
            ele.style[key] = ele.origStyle[key];
          }
        }
        //or just the one
        else if (typeof ele.origStyle[style] !== "undefined"){
          ele.style[style] = ele.origStyle[style];
        }
      }
    },
    
    setAttr: function(ele, attr, val){
      ele.origAttrs = ele.origAttrs || {};
      if (typeof ele.origAttrs[attr] === "undefined"){
        ele.origAttrs[attr] = ele.getAttribute(attr);
      }
      if (ele.getAttribute(attr) != val){
        ele.setAttribute(attr, val);
      }
    },
    
    restoreAttr: function(ele, attr){
      if (ele.origAttrs && typeof ele.origAttrs[attr] != "undefined"){
        if (ele.origAttrs[attr] === null){
          ele.removeAttribute(attr);
        }
        else {
          ele.setAttribute(attr, ele.origAttrs[attr]);
        }
      }
    },
    
    //get the position of an element relative to the document
    getBox: function(ele){
      var box = ele.getBoundingClientRect();
      //adjustments from jQuery
      var body = ele.ownerDocument.body,
			win = ele.ownerDocument.defaultView,
			docElem = ele.ownerDocument.documentElement,
			clientTop  = docElem.clientTop  || body.clientTop  || 0,
			clientLeft = docElem.clientLeft || body.clientLeft || 0,
			scrollTop  = (win.pageYOffset || docElem.scrollTop  || body.scrollTop ),
			scrollLeft = (win.pageXOffset || docElem.scrollLeft || body.scrollLeft);
      
      return {
        top: box.top  + scrollTop  - clientTop,
        left: box.left + scrollLeft - clientLeft,
        width: box.right - box.left,
        height: box.top - box.bottom,
        right: box.right,
        bottom: box.bottom
      };
    },
    
    fixEvent: function(evt){
      //offsetX/Y = offset of the mouse event with the event target.
      //this can be calculated from layerX and the 
      if (typeof evt.offsetX == "undefined"){
        //offset = pageX - elements pageX
        var box = Utils.getBox(evt.target);
        evt.offsetX = evt.pageX - box.left;
        evt.offsetY = evt.pageY - box.top;
      }
      
      return evt;
    },
    
    
    ele: function(tagname, attrs, childNodes, parent){
      var doc = parent ? parent.ownerDocument : document;
      attrs = attrs || {};
      var ele = doc.createElement(tagname);
      //attributes
      for(var attr in attrs){
        if (attr == "style" && typeof attrs[attr] == "object"){
          var styleStr = "";
          for(var style in attrs[attr]){
            styleStr += style +":"+ attrs[attr][style] +";";
          }
          ele.setAttribute(attr, styleStr);
        }
        else {
          ele.setAttribute(attr, attrs[attr]);
        }
      }
      //children
      if (childNodes){
        if (!Utils.isArray(childNodes)){
          childNodes = [childNodes];
        }
        for(var i=0; i<childNodes.length; i++){
          if (typeof childNodes[i] == "string"){
            ele.appendChild(doc.createTextNode(childNodes[i]));
          }
          else {
            ele.appendChild(childNodes[i]);
          }
        }
      }
      //and append?
      if (parent){
        parent.appendChild(ele);
      }
      return ele;
    },
    
    remove: function(ele){
      ele.parentNode.removeChild(ele);
    },
    
    
    injectCSS: function(css, doc){
      doc = doc || document;
      return Utils.ele('style', {type: 'text/css'}, css, doc.getElementsByTagName('head')[0]); 
    },
    
    insertScript: function(src, doc, id){
      doc = doc || document;
      var script = doc.createElement('script');
      script.setAttribute('type', "text/javascript");
      script.setAttribute('src', src);
      if (id){
        script.setAttribute('id', id);
      }
      doc.documentElement.appendChild(script);
    },
    
    extend: function(){
      var newObj = {};
      for(var i=0; i<arguments.length; i++){
        for(var key in arguments[i]){
          newObj[key] = arguments[i][key];
        }
      }
      return newObj;
    },
    
    //safely base64 encode an object
    base64Encode: function(obj){
      //convert to string
      var str = JSON.stringify(obj);
      // stringified objects can still contain unicode character
      var escapedStr = encodeURIComponent(str);
      //and finally
      return btoa(escapedStr);
    },
    
    //safely base64 encode an object
    base64Decode: function(str){
    
      try {
        var escapedJson = atob(str);
        var json = decodeURIComponent(escapedJson);
        return JSON.parse(json);
      }
      catch(e){
        //Lazarus.logger.error(e);
        return null;
      }
    },
    
    //convert an array into a hash map (javascript object)
    // eg arrayToMap(['a', 'b', 'c'])
    // returns {'a': true, 'b': true, 'c': true}
    arrayToMap: function(arr, value){
      value = (typeof value == "undefined") ? true : value;
      var map = {};
      for(var i=0; i<arr.length; i++){
        map[arr[i]] = value;
      }
      return map;
    },
    
    //converts a map into an array
    //NOTE: map keys will be lost
    mapToArray: function(map){
      var arr = [];
      for(var key in map){
        arr.push(map[key]);
      }
      return arr;
    },
    
    mapKeys: function(map){
      var keys = [];
      for(var key in map){
        keys.push(key);
      }
      return keys;
    },
    
    
    /*
    Compare two version strings (of the form X.X.X.X when X is on integer)
    comparison can be "=", ">", or "<", eg:
    versionCompare("1.2.3", ">", "1.2.0.7");
    returns true;
    */
    versionCompare: function(verStr, comparison, compareToStr){
      var ver1 = verStr.split(/\./g);
      var ver2 = compareToStr.split(/\./g);
      
      var segments = (ver1.length > ver2.length) ? ver1.length : ver2.length;
      var result = "";

      for (var i=0; i<segments; i++){
        var num1 = ver1[i] ? parseInt(ver1[i]) : 0; 
        var num2 = ver2[i] ? parseInt(ver2[i]) : 0;

        if (num1 > num2){
          result = ">";
          break;
        }
        else if (num1 < num2){
          result = "<";
          break;
        }            
      }
      
      if (!result){
        result = '=';
      }
      
      return (comparison.indexOf(result) > -1);        
    },
    
    
    //generate a random alphanumeric string of length x
    randomStr: function(len){
      var str = '';
      var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for(var i=0; i<len; i++){
        str += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return str;
    },
    
    //decodes the query segment of a URL into key/value pairs 
    decodeQuery: function(query){
      var m, params = {};
      
      //strip the "?" at the beginning of the query if it exists
      query = query.replace(/^\?/, '');
      //query string should now be of the form aa=bbb&cc=ddd&ee=fff...
      var m = query.match(/([^&=]+)=?([^&]*)/g);
      if (m){
        for(var i=0; i<m.length; i++){
          var bits = m[i].split('=', 2);
          var key = decodeURIComponent(bits[0].replace(/\+/g, ' '));
          var value = decodeURIComponent(bits[1].replace(/\+/g, ' '));
          if (Utils.isArray(params[key])){
            params[key].push(value);
          }
          else if (params[key]){
            //convert into an array
            params[key] = [params[key]];
            //and add the new value
            params[key].push(value);
          }
          else {
            params[key] = value;
          }
        }
      }
      return params;
    },
    
    isLargeTextField: function(fieldType){
      //allow fields and fieldTypes to  be passed
      if (typeof(fieldType) !== "string"){
        fieldType = Lazarus.Content.getFieldType(fieldType);
      }
      return (fieldType == "textarea" || fieldType == "contenteditable" || fieldType == "iframe");
    },
    
    isLargeTextFieldType: function(fieldType){
      return (fieldType == "textarea" || fieldType == "contenteditable" || fieldType == "iframe");
    },
    
    /**
    * return TRUE if the given document is in edit mode
    */
    isEditableDoc: function(doc){
      if (doc){
        if (doc.designMode == "on"){
          return true;
        }
        else if ((doc.body && doc.body.contentEditable === "true") || (doc.documentElement && doc.documentElement.contentEditable === "true")){
          return true;
        }
      }
      return false;
    },
    
    
    getDoc: function(ele){
      if (ele.ownerDocument){
        return ele.ownerDocument;
      }
      else if (typeof ele.toString == "function"){
        var str = ele.toString();
        return (str.indexOf("[object HTMLDocument]") > -1) ? ele : null;
      }
      else {
        return null;
      }
    },
    

    isContentEditableIframe: function(ele){
      var doc = Utils.getDoc(ele);
      return doc ? Utils.isEditableDoc(doc) : false;
    },
        
    getTagName: function(ele){
      return (ele && typeof ele.tagName == "string") ? ele.tagName.toLowerCase() : '';
    },
    
    stripTags: function(html){
      //removes HTML tags from a string
      html = html.replace(/<(\/)?\w+[^>]*>/ig, '').replace(/&nbsp;/ig, ' ').replace(/ +/g, ' ');
      return Utils.trim(html);
    },
    
    htmlToText: function(html){
      //we're going to format some html to look like text
      html = html.replace(/<br\s*(\/)?>/ig, '\n');
      html = html.replace(/<h\d[^>]*>/ig, '\n\n');
      html = html.replace(/<(\/)?(div|p)>/ig, '\n');
      //strip all other tags
      text = Utils.stripTags(html);
      //replace multiple line breaks with two line breaks
      text = text.replace(/[\r\n][\r\n\s]*[\r\n]/g, '\n\n');
      return Utils.trim(text);
    },
    
    jsonEncode: function(obj){
      return JSON.stringify(obj);
    },
    
    jsonDecode: function(str){
      try {
        return JSON.parse(str);
      }
      catch(e){
        if (Lazarus.logger){
          Lazarus.logger.error("Utils.jsonDecode: failed to decode string", str, e);
        }
        return null;
      }
    },
    
    replace: function(str, replacements, formatter){
      formatter = formatter || function(txt){return txt};
      
      for(var id in replacements){
        str = str.split("{"+ id +"}").join(formatter(replacements[id]));
      }
      return str;
    },
    
    
    extractDomain: function(url, extractBaseDomain){
      var m = url.match(/^http(s)?:\/\/([\w\-\.]+)/);
      if (m){
        var domain = m[2];
        
        if (extractBaseDomain){
          //if domain is an ip address return that 
          var m = domain.match(/\d+\.\d+\.\d+\.\d+$/);
          if (m){
            return m[0];
          }
          else {

            //known top level domains (TLDs) including country specific ones
            
            //http://en.wikipedia.org/wiki/Country_code_top-level_domain
            //all domains *should* either end in a 2 letter tld (google.co.nz, google.com.au) or none (google.com) for american sites
            //that should be preceded by a generic tld (.com, .net, .school, .name, etc)
            //and then the basedomain
            var m = domain.match(/[^\.]+\.[^\.]+(\.\w{2})?$/);
            //if we cant figure it out then return the whole domain
            return m ? m[0] : domain;	
          }
        }
        else {
          return domain;
        }
      }
      else {
        return '';
      }
    },
    
    urlAdd: function(url, params){
      for(var param in params){
        url += (url.indexOf('?') == -1) ? '?' : '&';
        url += encodeURIComponent(param) +'='+ encodeURIComponent(params[param]);
      }
      return url;
    }
	}

})();

