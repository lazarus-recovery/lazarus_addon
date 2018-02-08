/*
Safari specific functionality
*/
(function(ns){

  if (ns.platform.id == "safari"){
  
    Lazarus.baseURI = safari.extension.baseURI;

    Lazarus.preferencePrefix = "lazarus.preference.";

    //overwrite the toolbarIcons
    //NOTE: Safari only ever uses the one icon :(
    Lazarus.toolbarIcons = {
      'enabled': 'images/toolbar-icon-enabled-safari.png',
      'enabling': 'images/toolbar-icon-disabled-safari.png',
      'disabled': 'images/toolbar-icon-disabled-safari.png',
      'disabledForURL': 'images/toolbar-icon-disabled-safari.png',
      'syncError': 'images/toolbar-icon-disabled-safari.png',
      'syncMessages': 'images/toolbar-icon-enabled-safari.png'
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
        var val;
        if (localStorage && localStorage[name]){
          val = JSON.parse(localStorage[name]);
        }
        else if (typeof Lazarus.prefs[prefName] !== "undefined"){
          val = Lazarus.prefs[prefName];
        }
        else if (defaultVal !== null && typeof defaultVal != "undefined"){
          val = defaultVal;
        }
        else {
          throw Error("Unknown preference '"+ prefName +"'");
        }
        
        setTimeout(function(){
          callback(val);
        }, 1);
      
      }
      else {
        Lazarus.callBackground("Lazarus.getPref", [prefName, callback]);
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
            if (val === null){
              localStorage.removeItem(name);
            }
            else {
              localStorage[name] = JSON.stringify(val);
            }
            Lazarus.Event.fire("preferenceChange", prefName, val, oldVal);
          }
          callback(true);
        })
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
      
      for (var key in localStorage){
        if (key.indexOf(Lazarus.preferencePrefix) === 0){
          localStorage.removeItem(key);
        }
      }
      setTimeout(function(){
        callback(true);
      }, 1);
    }


    /**
    * call a function on the background page
    **/
    Lazarus.callBackground = function(funcName, args){
      gEvent.callBackground(funcName, args);
    }

    /**
    * opens a url in a new tab and focuses on said tab
    **/
    Lazarus.openURL = function(url){
      var tab = safari.application.activeBrowserWindow.openTab();
      tab.url = url;
    }

    Lazarus.platformInitBackground = function(){
      gEvent.init("background");
    }
    //platform specific initialization code for the content page 
    Lazarus.platformInitContent = function(){
      gEvent.init("content");
      Lazarus.Content.initDoc(document);
    }


    Lazarus.getExtensionInfo = function(callback){

      var NODE_TYPE_ELEMENT = 1;
      var xhr = new XMLHttpRequest();
      xhr.open("GET", safari.extension.baseURI +"Info.plist");
      xhr.onreadystatechange = function(){
        if (xhr.readyState == 4){
          if (xhr.responseXML){
            var extension = {};
            var xmlDoc = xhr.responseXML;
            //the plist format is not exactly the best use of xml I've seen
            var dict = xmlDoc.getElementsByTagName('dict')[0];
            if (dict){
              for(var i=0; i<dict.childNodes.length; i++){
                var child = dict.childNodes[i];
                //ignore text nodes (whitespace)
                if (child.nodeName && child.nodeName == "key"){
                  var key = child.firstChild.data;
                  var valNode = child.nextElementSibling;
                  switch(valNode.nodeName){
                    case "string":
                      extension[key] = ""+ valNode.firstChild.data;
                    break;
                  }
                }
              }
              //safari uses weird version identifiers
              extension['version'] = extension['CFBundleVersion'];
              callback(extension);
            }
            else {
              callback(null);
              throw Error("getVersion: unable to extract dict node from Info.plist.");
            }
          }
          else {
            callback(null);
            throw Error("getVersion: unable to extract version number from Info.plist. Not a valid xml file?");
          }
        }
      }
      xhr.send(null);
    }


    /*
    Updates the browser UI toolbar button 
    */
    Lazarus.updateToolbarButton = function(props){

      // //initialise the button if it doesn't already exist
      if (!Lazarus.updateToolbarButton.toolbarButton){
        Lazarus.updateToolbarButton.toolbarButton = {};
        
        safari.application.addEventListener("command", function(evt){
          if (evt.command == "lazarus-toolbar-item-command" && Lazarus.updateToolbarButton.toolbarButton.onclick && !Lazarus.updateToolbarButton.toolbarButton.disabled){
            Lazarus.updateToolbarButton.toolbarButton.onclick();
          }
        }, false);
      }
      
      // //update properties
      for(var prop in props){
        Lazarus.updateToolbarButton.toolbarButton[prop] = props[prop];
      }
       
      var toolbarItem = safari.extension.toolbarItems[0];  
      // //tooltip,
      if (props.tooltip){
        toolbarItem.toolTip = props.tooltip;
      }
      // //icon,
      if (props.icon){
        toolbarItem.image = Lazarus.baseURI + props.icon;
      }
      //
      if (typeof props.disabled == "boolean"){
        toolbarItem.disabled = props.disabled;
      }
      
      // //onclick is already handled
    }


    Lazarus.fetchCurrentURL = function(callback){
      if (safari.application.activeBrowserWindow && safari.application.activeBrowserWindow.activeTab){
        callback(safari.application.activeBrowserWindow.activeTab.url);
      }
      else {
        callback(null);
      }
    }


    Lazarus.addURLListener = function(listener){
      safari.application.addEventListener("activate", listener, true);
      safari.application.addEventListener("open", listener, true);
      safari.application.addEventListener("close", listener, true);
      safari.application.addEventListener("navigate", listener, true);
    }




    //global event handler functions
    window.gEvent = {
      init: function(type){
        switch(type){
          case "content": 
            //listen for responses from the background scripts
            if (Lazarus.logger){
              Lazarus.logger.log("gevent-init-content");
            }
            safari.self.addEventListener("message", function(evt){
              //console.log("message received", evt);
              if (evt.name == "gevent-call-background-response"){
                gEvent.onCallBackgroundResponse(evt);
              }
            }, false);
          break;
          
          case "background":
            //listen for messages from the content scripts
            if (Lazarus.logger){
              Lazarus.logger.log("gevent-init-background");
            }
            safari.application.addEventListener("message", function(evt){
              if (evt.name == "gevent-call-background"){
                gEvent.onCallBackground(evt);
              }
            }, false);
          break;
          
          default:
            throw Error("Unknown initalize type '"+ type +"'");
        }
      },
      
      
      onCallBackground: function(evt){
        //find the function to call
        if (Lazarus.logger){
          Lazarus.logger.log("gevent-on-call-background", evt);
        }
        var callbackInfo = evt.message;
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
          //if the caller has passed a function argument, then we will assume that the first function argument is a callback.
          
          if (callbackInfo.callbackIndex > -1){
            //the function to call requires a callback function itself.
            //so we'll have to add a callback to the arguments, and capture the result
            //before sending the response
            //The callback function will be the callbackInfo.callbackIndex(th) argument.
            var args = callbackInfo.args;
            args[callbackInfo.callbackIndex] = function(result){
              callbackInfo.result = result;
              if (Lazarus.logger){
                Lazarus.logger.log("target", evt.target);
              }
              evt.target.page.dispatchMessage("gevent-call-background-response", callbackInfo);
            };
            obj.apply(context, args);
          }
          else {
            callbackInfo.result = obj.apply(context, callbackInfo.args);
            //and pass the result back to the calling page
            evt.target.page.dispatchMessage("gevent-call-background-response", callbackInfo);
          }
        }
        else {
          throw Error("onCallBackground: "+ callbackInfo.funcName +" is not a background function");
        }
      },
      
      onCallBackgroundResponse: function(evt){
        if (Lazarus.logger){
          Lazarus.logger.log("gevent-on-call-background-response", evt);
        }
        var callbackInfo = evt.message;
        if (callBackgroundCallbacks[callbackInfo.callbackId]){
          callBackgroundCallbacks[callbackInfo.callbackId](callbackInfo.result);
          //and cleanup 
          delete callBackgroundCallbacks[callbackInfo.callbackId];
        }
        else if (callbackInfo.callbackId){
          //hmmm, was the message ment for a frame within this page?
          // if (window.frames && window.frames.length > 1){
            // //send the response to all the other frames in this document
            // for(var i=0; i<window.frames.length; i++){
              // var win = window.frames[i].contentWindow;
              // alert(i);
              // console.log("posting message to frame", callbackInfo, win);
              // if (win){
                // win.postMessage(evt.message);
              // }
            // }
          // }
          if (Lazarus.logger){
            Lazarus.logger.error("callback "+ callbackInfo.callbackId +" not found");
          }
        }
      },
      
    
    
      /*
      call a function on the background page,
      and then call the callback with the results
      */
      callBackground: function(funcName, args){
        if (Lazarus.logger){
          Lazarus.logger.log("gevent-call-background", funcName, args);
        }
        
        args = args || [];
      
        var callbackInfo = {
          funcName: funcName,
          args: args,
          callbackId:  0,
          callbackIndex: -1
        }
        
        
        //does the background function require a callback argument?
        for (var i=0; i<args.length; i++){
          //we'll assume that the background function only has one function argument, and that argument is the callback function
          if (typeof args[i] == "function"){
            if (callbackInfo.callbackId){
              //bugger a callback function has already been defined.
              throw Error("gEvent.callBackground function can take at most ONE function argument. More than one given. "+ args);
            }
            else {
              callbackInfo.callbackId = (new Date()).getTime() +"-"+ Math.random().toString().replace(".", "");
              callBackgroundCallbacks[callbackInfo.callbackId] = args[i];
              callbackInfo.callbackIndex = i;
              callbackInfo.args[i] = null;
            }
          }
        }
        
        //send a message to the background page
        safari.self.tab.dispatchMessage("gevent-call-background", callbackInfo);
      }
    }
      
    var callBackgroundCallbacks = {};
  }
})(Lazarus)
