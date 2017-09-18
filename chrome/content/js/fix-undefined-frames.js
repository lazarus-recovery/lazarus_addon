/*

ref: http://code.google.com/p/chromium/issues/detail?id=20773

this script is designed to fix a single bug in google chrome that prevents dymanically created iframes
from being accessed from the parent document (window.frames['iframe'].contentWindow === undefined 
when it should be the iframe's window object)

== install ==

place the fix-undefined-frames.js file in the /js/ folder of your addon (you can place it elsewhere 
if you like, but you'll need to edit the SCRIPT_PATH variable below to point the script's new location 
relative to the addon root directory)

-- js/fix-undefined-frames.js --

var SCRIPT_PATH = 'js/fix-undefined-frames.js';

----


run the script in every frame of every document before load by adding the following to your manfest.json file

--- /manifest.json --

"content_scripts": [{
  "matches": ["<all_urls>"],
    "js": [
      "js/fix-undefined-frames.js",
    ],
  "all_frames" : true,
  "run_at": "document_start"
}]

----

It will inject itself into the unprivileged world of each "normal" document.
Once injected it will fire a custom "fixundefinedframes:documentready" event whenever an about:blank 
page is loaded or created. Upon hearing the event the privileged world will be able to add event listeners 
to the about:blank document and it's window by using the custom addEventListener function attached to the custom event

-- /content.js --

document.addEventListener("fixundefinedframes:documentready", function(evt){
    
  console.log("fixundefinedframes:documentready fired", evt);
  
  var doc = evt.detail.origDoc;
  var win = evt.detail.origWin;
  
  evt.detail.addEventListener(doc, 'click', function(clickEvt){
    console.log("keyup event fired ini an about:blank document", clickEvt);
  });
  
  evt.detail.addEventListener(win, 'resize', function(resizeEvt){
    console.log("resize event fired in an about:blank window", resizeEvt);
  }, true);
})


IMPORTANT: the evt.detail.origDoc and evt.detail.origWin are UNPRIVILEDGED (evt.detail.origWin.chrome.extension == undefined)
so it's important to use evt.detail.addEventListener rather than trying to use evt.detail.origWin.addEventListener 
or evt.detail.origDoc.addEventListener as these will appear to work, but any code run will not be able to 
view the defaultView of any document within the listener.

eg 

evt.detail.origDoc.addEventListener('click', function(clickEvt){
  console.log("click event fired in an about:blank document", clickEvt);
  var win = clickEvt.target.ownerDocument.defaultView; // FAILS. win === undefined!
}, true);

evt.detail.addEventListener(doc, 'click', function(clickEvt){
  console.log("click event fired in an about:blank document", clickEvt);
  var win = clickEvt.target.ownerDocument.defaultView; // WORKS. win is a Window object.
}, true);


== What's actually happening ==

Firstly we need some definitions:

* "content script": This is the script added by the chrome extension API (ref: http://code.google.com/chrome/extensions/content_scripts.html)
  it has priviledges (window.chrome.extension) and can run *some* chrome API functions (eg window.chrome.extension.getURL())
  but due to this bug (http://code.google.com/p/chromium/issues/detail?id=20773) 
  this script CANNOT see the contentWindow of a dynamically generated blank iframe.
  

* "content document": A "normal" (non-blank) webpage. This has no priviledges (window.chrome.extension === undefined), 
  but it CAN see the contentWindow of a dynamically generated blank iframe.
  
* "injected script": A script added to a content document (via a <script type="text/javascript" /> tag) 
  The script runs with no elevated priviledges and runs in the content documents isolated world

* "blank document": The DOM document of an about:blank page

* "blank window": The contentWindow of an about:blank page


== How it works ==

The fix-undefined-frames.js content script is injected into every valid content document via the chrome extension API.
It looks to see if the content document contains any frames. If any frames are found, or new frames are added, 
then it adds a script tag to the page to inject itself into the content document. This script is recursive so it'll
inject itself in sub-sub-sub frames and so on.

The injected script runs in the normal page's isolated world, it can see the iframes contentWindow and contentDocument.
The injected script fires a custom "fixundefinedframes:documentready" event whenever an iframe is first detected, or is reloaded
The custom event has a custom method attached to it called event.details.addEventListener when called it creates 
a new custom event (fixundefinedframes:addlistener) and fires that on the document. Our injected script hears the
fixundefinedframes:addlistener event and then adds the appropriate listener to the contentWindow or contentDocument
of the iframe. Phew!

*/

(function(){

  //set to true to view log messages  
  var DEBUGGING = false;
  
  //set the the path of this script (relative to the addon root directory)
  var SCRIPT_PATH = 'js/fix-undefined-frames.js';
  
  // ----- you can safely ignore everything below this line if you like ------ //
  var log = DEBUGGING ? console.log.bind(console, '[fix-undefined-frames]') : function(){};

  var fixUndefinedFrames = {
  
    fixPrivilegedDoc: function(doc){
      var win = doc.defaultView;
      //only inject into pages that contain an iframe
      if (win.frames && win.frames.length){
        //inject our script into the page
        if (!doc.documentElement.getAttribute("fixundefinedframes-status")){
          //inject our unprivileged script
          doc.documentElement.setAttribute("fixundefinedframes-status", "injecting-script");
          log('injecting unpriviledged script into '+ doc.URL);
          fixUndefinedFrames.injectScript(doc, chrome.extension.getURL(SCRIPT_PATH));
          doc.documentElement.setAttribute("fixundefinedframes-status", "initialized");
        }
      }
    },
    
  
    //inject this script into all privileged pages so that is runs with no privileges (this will let us see the frame.contentWindow)
    initPrivilegedDoc: function(doc){
      log("initPrivilegedDoc", doc.URL);
      //only inject into pages that contain about:blank iframes
      doc.addEventListener("DOMNodeInserted", function(){
        fixUndefinedFrames.fixPrivilegedDoc(doc);
      }, false);
      
      fixUndefinedFrames.fixPrivilegedDoc(doc);
    },
    
    
    //return TRUE if src results in an about:blank page being loaded
    isAboutBlankURL: function(src){
      if (src){
        src = src.toLowerCase().trim();
        return (src == "about:blank") || /^javascript:/.test(src);
      }
      else {
        return true;
      }
    },
    
    
    getBlankDocs: function(doc){
      var docs = [];
      var iframes = doc.getElementsByTagName('iframe');
      if (iframes){
        for(var i=0; i<iframes.length; i++){
          var src = iframes[i].getAttribute("src");
          if (fixUndefinedFrames.isAboutBlankURL(src)){
            docs.push(iframes[i].contentWindow.document);
          }
        }
      }
      
      var frames = doc.getElementsByTagName('frame');
      if (frames){
        for(var i=0; i<frames.length; i++){
          var src = frames[i].getAttribute("src");
          if (fixUndefinedFrames.isAboutBlankURL(src)){
            docs.push(frames[i].contentWindow.document);
          }
        }
      }
      
      //objects
      var objects = doc.getElementsByTagName('object');
      if (objects){
        for(var i=0; i<objects.length; i++){
          var src = objects[i].getAttribute("data");
          //NOTE: data attribute MUST exist for an object to load an about:blank page
          if (src && fixUndefinedFrames.isAboutBlankURL(src)){
            docs.push(objects[i].contentDocument);
          }
        }
      }
      
      return docs;
    },
    
    
    fixUnprivilegedDoc: function(doc){
      var win = doc.defaultView;
      var docs = fixUndefinedFrames.getBlankDocs(doc);
      
      log("fixUnprivilegedDoc", doc.URL, win.frames.length, "blank docs = "+ docs.length);
      for(var i=0; i<docs.length; i++){
        var blankDoc = docs[i];
        //don't "fix" the same document more than once
        if (!blankDoc.fixUndefinedFramesDocumentFixed){
          fixUndefinedFrames.fixBlankDoc(blankDoc, doc);
          blankDoc.fixUndefinedFramesDocumentFixed = true;
        }
      }
    },
    
    
    getParentDoc: function(doc){
      return (doc && doc.defaultView && doc.defaultView.frameElement && doc.defaultView.frameElement.ownerDocument) ? doc.defaultView.frameElement.ownerDocument : null;
    },
    
    
    getParentPrivilegedDoc: function(doc){
      while(doc){
        if (doc && doc.documentElement && doc.documentElement.getAttribute("fixundefinedframes-status")){
          return doc;
        }
        else {
          doc = fixUndefinedFrames.getParentDoc(doc);
        }
      }
      //not found
      return null;
    },
    
    
    fixBlankDoc: function(doc){
    
      //and then treat it much like another unprivileged document (gee thanks gmail for your iframes within iframes within frakking iframes!)
      //listen for changes to this document also, just in case this iframe creates NEW about:blank iframes!
      fixUndefinedFrames.initUnprivilegedDoc(doc);
      
      //listen for the page being re-loaded 
      var frame = doc.defaultView.frameElement;
      if (frame && !frame.fixUndefinedFramesLoadListenerAdded){
        frame.addEventListener('load', function(evt){
          var frameDoc = (frame.contentWindow && frame.contentWindow.document) ? frame.contentWindow.document : null;
          
          if (frameDoc){
            log("frameDoc.URL", frameDoc.URL, frameDoc.body.innerHTML, frameDoc.fixUndefinedFramesDocumentReadyFired);
            //need to reset the fixUndefinedFramesDocumentReadyFired flag because using document.write doesn't appear to clear this flag
            //even though a new document is being created.
            frameDoc.fixUndefinedFramesDocumentReadyFired = false;
            fixUndefinedFrames.fixBlankDoc(frameDoc);
          }
        }, false);
        frame.fixUndefinedFramesLoadListenerAdded = true;
      }
      
      log("fix about:blank document", "parent doc = ", fixUndefinedFrames.getParentDoc(doc) ? fixUndefinedFrames.getParentDoc(doc).URL : 'null');
    
      //all we're going to do here is fire an init-blank-doc event, this will allow our "normal" (privileged) code
      //to listen for the event and add whatever event listeners it needs to to the document
      //find the first privileged document to fire the event on
      var parentDoc = fixUndefinedFrames.getParentPrivilegedDoc(doc);
      if (parentDoc){
        if (!doc.fixUndefinedFramesDocumentReadyFired){
          var win = doc.defaultView;
          doc._defaultView = win;
          
          //listen for messages from our background page
          doc.addEventListener("fixundefinedframes:addlistener", fixUndefinedFrames.onAddEventListener, false);
          
          //tell our code that the frame has loaded
          fixUndefinedFrames.propagateEvent({type:'documentready'}, parentDoc, win, doc);
          doc.fixUndefinedFramesDocumentReadyFired = true;
        }
        else {
          log("doc.fixDocFired", doc.body.innerHTML);
        }
      }
      else {
        throw Error("Unable to find owner document of about:blank", doc);
      }
    },
    
    
    onAddEventListener: function(evt){
      //adds an event listener into the "unpriviledged" context of this document
      var detail = evt.detail;
      detail.target.addEventListener(detail.type, detail.listener, detail.useCapture);
      log("onAddEventListener", evt);
    },
    
    
    propagateEvent: function(origEvent, parentDoc, win, doc){
    
      log("propagateEvent", origEvent, parentDoc);
      
      //figure out what type of event it is, so we can properly clone it and all it's properties
      //NOTE: we need to use win.EventConstructor not EventConstructor because the event was created in the non-priviledged window (win)
      var eventDetails = {
        origEvent: origEvent,
        origWin: win,
        origDoc: doc,
        parentDoc: parentDoc,
        frameElement: win.frameElement,
        addEventListener: function(target, type, listener, useCapture){
          useCapture = (typeof useCapture == "boolean") ? useCapture : false;
          var addEventDetails = {
            target: target,
            type: type,
            //need to wrap the listener in a function so it gets called in the correct isolated world
            listener: function(evt){listener(evt)},
            useCapture: useCapture
          };
          
          fixUndefinedFrames.fireCustomEvent(doc, "fixundefinedframes:addlistener", addEventDetails);
        }
      };
      
      win.frameElement._contentDocument = doc;
      win.frameElement._contentWindow = win;
      
      fixUndefinedFrames.fireCustomEvent(parentDoc, "fixundefinedframes:"+ origEvent.type, eventDetails);
    },
    
    
    fireCustomEvent: function(doc, type, details){
      var newEvt = doc.createEvent("CustomEvent");
      newEvt.initCustomEvent(type, true, true, details);
      doc.dispatchEvent(newEvt);
    },
    
    
    initUnprivilegedDoc: function(doc){
    
      log("initUnPrivilegedDoc", doc.URL);
      
      doc.addEventListener("DOMNodeInserted", function(){
        fixUndefinedFrames.fixUnprivilegedDoc(doc);
      }, false);
      
      fixUndefinedFrames.fixUnprivilegedDoc(doc);
      
      //and now we're finished, remove our script
      var script = doc.getElementById("fixundefinedframes-script");
      if (script){
        script.parentNode.removeChild(script);
      }
    },
    
    
    injectScript: function(doc, url){
  
      //log('injecting script into '+ doc.URL);
      var script = doc.createElement('script');
      script.type = "text/javascript";
      script.src = url; 
      script.id = "fixundefinedframes-script";
      
      //append directly to <html> element (normal scripts might remove or edit the head of the document)
      //frakness, apparently the document doesn't yet exist in some cases. Wonderful.
      if (doc.documentElement){
        doc.documentElement.appendChild(script);
      }
      else {
        setTimeout(function(){
          if (doc.documentElement){
            doc.documentElement.appendChild(script);
          }
          else {
            throw Error("Lazarus: unable to inject fixundefinedframes script: documentElement doesn't exist yet");
          }
        }, 1);
      }
    }
  }
  
  
  //FRAK: gmail (https://mail.google.com/mail/ca/u/0/?shva=1#drafts/1372665a64174e27) is giving me access to a chrome.extension code
  // I can actually run chrome.extension.sendMessage from this unpriviledged page! This is not a good thing?
  // Further investigation says that this page is a webapp build in to chrome by default.
  // Ok, we're going to have to do a little bit of checking here
  var script = document.getElementById('fixundefinedframes-script');
  //privileged
  if (!script){
    //have to make sure that this is not our script
    fixUndefinedFrames.initPrivilegedDoc(document);
    
    //allow extensions to call the our fixUndefinedFrames code?
    window.fixUndefinedFrames = fixUndefinedFrames;
  }
  //unprivileged "normal" document with our script injected into it
  else {
    fixUndefinedFrames.initUnprivilegedDoc(document);
  }
  
})();
