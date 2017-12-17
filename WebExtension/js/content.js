
(function(){

	Lazarus.environment = "content";

	Lazarus.Content = {
  
    //time (in milliseconds) the user has to stop typing for 
    //before we send an autosave request to the background page
    autosaveDelay: 500, 
  
    MIN_TEXT_FOR_TOOLTIP: 20, //characters
    
    MAX_TEXT_FOR_TOOLTIP: 512, //characters
    
    //time (in milliseconds) a form must be unchanged for before a user is considered to have stopped/paused editing this form
    EDITING_IDLE_TIME: 5 * 60 * 1000, 
    
    btnStyles: {
      display: 'none', //hidden to start with
      width: '22px',
      height: '22px',
      background: "transparent no-repeat 0px 0px",
      backgroundImage: "url('{baseURI}images/lazarus-btn.png')",
      cursor: 'pointer',
      position: 'fixed',
      top: '0px',
      left: '0px',
      opacity: '0.33',
      zIndex: '99999'
    },
    
		init: function(){
		
		},
		
		initDoc: function(doc){
      //TODO: initalise locale? Is this still needed?
      
      Lazarus.callBackground("Lazarus.Background.isDomainEnabled", [doc.domain, function(enabled){
        if (enabled){
          Lazarus.Content.enableDoc(doc);
        }
      }]);
		},
    
    enableDoc: function(doc){
      //add event handlers for this document
      Lazarus.logger.log("init doc", doc.URL);
      Lazarus.Utils.addEvent(doc, "submit", Lazarus.Content.onSubmit);
      Lazarus.Utils.addEvent(doc, "focus", Lazarus.Content.onFocus, true);
      Lazarus.Utils.addEvent(doc, "blur", Lazarus.Content.onBlur, true);
      Lazarus.Utils.addEvent(doc.defaultView, "scroll", function(evt){
        Lazarus.Content.onScroll(evt, doc);
      }, true);
      Lazarus.Utils.addEvent(doc, "scroll", function(evt){
        Lazarus.Content.onScroll(evt, doc);
      }, true);
      
      //autosaves
      Lazarus.Utils.addEvent(doc, "keyup", Lazarus.Content.onKeyUp);
      Lazarus.Utils.addEvent(doc, "change", Lazarus.Content.onChange, true);
      Lazarus.Utils.addEvent(doc, "reset", Lazarus.Content.onReset, true);
      Lazarus.Utils.addEvent(doc, "click", Lazarus.Content.onClick, true);
      
      //chrome only (fix for the undefined frames problem)
      Lazarus.Utils.addEvent(doc, "fixundefinedframes:documentready", Lazarus.Content.onBlankDocReady, true);
      
      //mouse handlers (for popup menu)
      Lazarus.Mouse.initDoc(doc);
    },
    
    
    onScroll: function(evt, doc){
    
      //reposition any visible lazarusbuttons
      var btns = doc.getElementsByTagName('lazarusbutton');
      for(var i=0; i<btns.length; i++){
        var btn = btns[i];
        if (btn.currentEle){
          Lazarus.Content.positionButton(btn, btn.currentEle);
        }
      }
      //and hide any lazarus menus
      if (doc.lazarusMenu){
        doc.lazarusMenu.hide();
      }
    },
    
    
    //fires whenever an about:blank iframe is added to a document
    onBlankDocReady: function(evt){
    
      var doc;
      if (evt.detail && evt.detail.origDoc) {
        doc = evt.detail.origDoc;
        var win = evt.detail.origWin;
        
        //we cant attach event handlers directly (they are run in the wrong context)
        evt.detail.addEventListener(doc, 'keyup', Lazarus.Content.onKeyUp);
        evt.detail.addEventListener(doc, 'focus', Lazarus.Content.onFocus, true);
        //focus event doesn't fire unless the active element changes?, and because the iframe
        //can have it's own active element, even when the iframe itself doesn't have the focus then 
        //sometimes clicking on the iframe doesn't fire an onFocus event
        evt.detail.addEventListener(doc, 'click', Lazarus.Content.onFocus, true);
        evt.detail.addEventListener(doc, 'keyup', Lazarus.Content.onFocus, true);
        evt.detail.addEventListener(doc, 'blur', Lazarus.Content.onBlur, true);        
      }
      else {
        var iframes = document.querySelectorAll("iframe");
        for (var i = 0; i < iframes.length; ++i) {
          if (!iframes[i].contentWindow || !iframes[i].contentWindow.document)
            continue;
          if (iframes[i].getAttribute("data-lazarus-attached") == "true")
            continue;
          doc = iframes[i].contentWindow.document;
          //we cant attach event handlers directly (they are run in the wrong context)
          doc.addEventListener('keyup', Lazarus.Content.onKeyUp);
          doc.addEventListener('focus', Lazarus.Content.onFocus, true);
          //focus event doesn't fire unless the active element changes?, and because the iframe
          //can have it's own active element, even when the iframe itself doesn't have the focus then 
          //sometimes clicking on the iframe doesn't fire an onFocus event
          doc.addEventListener('click', Lazarus.Content.onFocus, true);
          doc.addEventListener('keyup', Lazarus.Content.onFocus, true);
          doc.addEventListener('blur', Lazarus.Content.onBlur, true);
          iframes[i].setAttribute("data-lazarus-attached", "true");
        }
        return;
      }
    },
    
    onClick: function(evt){
      Lazarus.callBackground("Lazarus.Sync.onClick");
    },
    
    onXHR: function(evt){
      try {
        var data = JSON.parse(evt.newValue);
      }
      catch(e){
        //failed to parse json data, is someone firing a non-valid LazarusXMLHttpRequestSend event?
        Lazarus.logger.warn('Invalid LazarusXMLHttpRequestSend data "'+ evt.newValue +'"');
        return;
      }
      
      if (data && data.postData){
        //extract the post data into separate values
        //TODO: handle other encodings (like application/json)
        //at the moment we only handle application/x-www-form-urlencoded
        var formData = Lazarus.Utils.decodeQuery(data.postData);
        var doc = evt.target;
        var texts = Lazarus.Content.getLargeTextFields(doc);
        
        for(var i=0; i<texts.length; i++){
          var textbox = texts[i];
          var textValue = Lazarus.Content.getFieldValue(textbox);
          
          for(var id in formData){
            if (formData[id] == textValue){
              //assume the text has been submitted and make a full save.
              var form = Lazarus.Content.findForm(textbox);
              if (form){
                var info = Lazarus.Content.getFormInfo(form);
                Lazarus.logger.log("saving form...");
                Lazarus.callBackground("Lazarus.Background.saveForm", [info]);
              }
            }
          }
        }
      }
    },
    
    //returns an array of all of the multiline editable fields on a page
    //this should include all WYSIWYGs, ContentEditable divs, and textareas
    //HMMM, possibly quite CPU intensive if there are a large amount of elements on a page (eg google spreadsheet!)
    //needs testing
    getLargeTextFields: function(doc){
      var found = [];
      //get the easy ones
      var eles = doc.getElementsByTagName('textarea');
      for(var i=0; i<eles.length; i++){
        found.push(eles[i]);
      }
      //ContentEditable elements
      //NOTE: at this point we're only going o be looking for divs, not every element on a page (too CPU intensive [untested])
      var eles = doc.getElementsByTagName('div');
      for(var i=0; i<eles.length; i++){
        if (Lazarus.Utils.isLargeTextField(eles[i])){
          found.push(eles[i]);
        }
      }
      
      return found;
    },
    
    
    disableDoc: function(doc, field){
      //disable lazarus on this document
      //remove all of our event handlers
      Lazarus.Utils.removeEvent(doc, "submit", Lazarus.Content.onSubmit);
			Lazarus.Utils.removeEvent(doc, "focus", Lazarus.Content.onFocus, true);
			Lazarus.Utils.removeEvent(doc, "blur", Lazarus.Content.onBlur, true);
			Lazarus.Utils.removeEvent(doc, "keyup", Lazarus.Content.onKeyUp);
			Lazarus.Utils.removeEvent(doc, "change", Lazarus.Content.onChange, true);
			Lazarus.Utils.removeEvent(doc, "reset", Lazarus.Content.onReset, true);
			Lazarus.Utils.removeEvent(doc, "click", Lazarus.Content.onClick, true);
      //Lazarus.Utils.removeEvent(doc, "LazarusXMLHttpRequestSend", Lazarus.Content.onXHR);
      Lazarus.Utils.removeEvent(doc, "scroll", Lazarus.Content.onScroll, true);
      
      //remove any lazarus button we may have added to the document
      
      Lazarus.Mouse.cleanupDoc(doc);
      Lazarus.Content.removeButtons(doc);
      
      if (field){
        //and tidy up the current element
        Lazarus.Content.cleanupField(field);
      }
    },
    
    onReset: function(evt){
      var field = Lazarus.Content.findField(evt.target);
      if (field){
        Lazarus.Content.autosave(field);
			}
      var form = Lazarus.Content.findForm(evt.target);
      if (form && form.formInstanceId){
        form.formInstanceId = null;
      }
    },
    
    onChange: function(evt){
      //if a form field changes value then send an "autosave" message to the background page
      var field = Lazarus.Content.findField(evt.target);
      if (field){
        Lazarus.Content.autosave(field);
			}
      var form = Lazarus.Content.findForm(evt.target);
      if (form){
        Lazarus.Content.restartEditTimer(form);
      }
    },
    
    
    autosave: function(field, callback){
      callback = callback || function(){}
      //find the form (if any) that this field is attached to
      Lazarus.logger.log('autosaving form...', field);
      var form = Lazarus.Content.findForm(field, true);
      if (form){
        var formInfo = Lazarus.Content.getFormInfo(form);
        
        //FIXME: use lazarusbutton instead of background image
        //if we're currently showing the lazarus icon for this field, then
        //show the user we're saving the form
        Lazarus.logger.log('autosaving form, sending to background page...', formInfo);
        //we'll want the callback so we can tell users when the form has been saved
        Lazarus.callBackground("Lazarus.Background.autosaveForm", [formInfo, function(){
          //restore the autosaved form
          callback(formInfo);
        }]);
      }
    },
    
    
		
		onSubmit: function(evt){
		
			var form = (evt.target.nodeName.toLowerCase() == 'form') ? evt.target : null;
			if (form){
				//send details of form to the background page to be saved
				var info = Lazarus.Content.getFormInfo(form);
				Lazarus.logger.log("saving form...");
				Lazarus.callBackground("Lazarus.Background.saveForm", [info]);
        //hmmm, page may be gone by the time this comes back?
        //so we won't add a callback?
			}
		},
		
		generateInstanceId: function(){
			return Math.floor(Math.random() * 2147483648);
		},
		
		
		getFormInfo: function(form){
		
      if (!form.lazarusInstanceId){
        form.lazarusInstanceId = Lazarus.Content.generateInstanceId();
      }
      
			var info = {};
			info.formInstanceId = form.lazarusInstanceId;
			info.url = form.ownerDocument.URL;
			info.domain = form.ownerDocument.domain;
			info.editingTime = Lazarus.Content.getEditTime(form);
      
			info.fields = [];
			
      var fields = Lazarus.Content.getFormFields(form);
			for(var i=0; i<fields.length; i++){
				var fieldInfo = Lazarus.Content.getFieldInfo(fields[i]);
				if (fieldInfo){
					info.fields.push(fieldInfo);
				}
			}
			
			return info;
		},
    
    
    getFormFields: function(form){
      var fields = [];
      for(var i=0; i<form.elements.length; i++){
        //only add fields of a known type
        var type = Lazarus.Content.getFieldType(form.elements[i]);
        if (type){
          fields.push(form.elements[i]);
        }
      }
      //add any content editable iframes found in the form
			//fake Forms don't have a getElementsByTagName method
      if (form.getElementsByTagName){
        var iframes = form.getElementsByTagName('iframe');
        for(var i=0; i<iframes.length; i++){
          var type = Lazarus.Content.getFieldType(iframes[i]);
          if (type){
            fields.push(iframes[i]);
          }
        }
      }
      return fields;
    },
		
		
		getFieldInfo: function(field){
			var info = {
        name: field.getAttribute("name") || '',
        type: Lazarus.Content.getFieldType(field),
				value: Lazarus.Content.getFieldValue(field),
				domain: field.ownerDocument.domain
      };
      //ContentEditables and WYSIWYG dont necessarily have name attributes :(
      if (!info.name && (info.type == "contenteditable" || info.type == "textarea" || info.type == "iframe")){
        info.name = "textbox";
      }
      return info;
		},
		
		
		getFieldType: function(field){
			var nodeName = field.nodeName.toLowerCase();
			switch(nodeName){
				case "select":
				case "textarea":
					return nodeName;
				break;
				
				case "input":
					var type = field.type.toLowerCase();
					switch(type){
						case "text":
						case "color":
						case "date":
						case "datetime":
						case "datetime-local":
						case "email":
						case "month":
						case "number":
						case "range":
						case "search":
						case "tel":
						case "time":
						case "url":
						case "week":
						case "password":
						case "checkbox":
						case "radio":
							return type;
						break;
					}
				break;
        
        case "iframe":
          //only return a field type if the iframe is in edit mode
          //console.log("getFieldType", field, field.contentDocument, field.contentDocument.defaultView, field.contentWindow);
          var iframeDoc = field.contentDocument;
          if (iframeDoc && Lazarus.Utils.isEditableDoc(iframeDoc)){
            return "iframe";
          };
        break;
			}
      
      //look for content editable divs
      var tagname = Lazarus.Utils.getTagName(field);
      if (Lazarus.Content.isContentEditableRoot(field) && tagname != "html" && tagname != "body"){
        return 'contenteditable';
      }
      else {
        return null;
      }
		},
    
    
    //return TRUE if given element is the topmost editable element.
    isContentEditableRoot: function(ele){
      return (ele && ele.isContentEditable && (!ele.parentNode || !ele.parentNode.isContentEditable));
    },
		
		
		getFieldValue: function(field){
			switch(Lazarus.Content.getFieldType(field)){
				//text fields
        case "text":
        case "color":
        case "date":
        case "datetime":
        case "datetime-local":
        case "email":
        case "month":
        case "number":
        case "range":
        case "search":
        case "tel":
        case "time":
        case "url":
        case "week":
        
				case "password":
				case "textarea":
				case "file":
				case "hidden":
					return Lazarus.Utils.trim(field.value);
						
				case "radio":
				case "checkbox":
					return {
						"valueAttr": (field.value === "") ? "on" : field.value,
						"checked": field.checked
					}
						
				case "select":
					//select boxes have the option to allow multiple selections
					var selected = [];
					if (field.options){
						for (var i=0; i<field.options.length; i++){
							if (field.options[i].selected){
								selected.push(Lazarus.Utils.trim(field.options[i].value));
							}
						}
					}
					return selected;
        
        case "contenteditable":
          return field.innerHTML;
				
				case "iframe":
					var doc = field.contentDocument;
					return (doc && doc.body && doc.body.innerHTML) ? doc.body.innerHTML : '';
						
				default:
					//unknown element type
					return null;
			}
		},
		
		setFieldValue: function(field, value){

			if (!Lazarus.Utils.isSet(field.lazarusOrigValue)){
				field.lazarusOrigValue = Lazarus.Content.getFieldValue(field);
			}
		
			switch(Lazarus.Content.getFieldType(field)){
				//text fields
				case "text":
        case "color":
        case "date":
        case "datetime":
        case "datetime-local":
        case "email":
        case "month":
        case "number":
        case "range":
        case "search":
        case "tel":
        case "time":
        case "url":
        case "week":
        
				case "password":
				case "textarea":
				case "file":
					field.value = value;
				break;
				
				case "radio":
				case "checkbox":
					field.checked = value;  
				break;
				
				case "select":
					//select boxes have the option to allow multiple selections
					if (field.options){
						for (var i=0; i<field.options.length; i++){
							//bugfix: RT: 101284
							//selecting each option is taking too long for large (10,000+ entries) select boxes,
							//so we should only change the option if it doesn't already match it's new selected state
							var selectOption = Lazarus.Utils.inArray(field.options[i].value, value);
							if (field.options[i].selected != selectOption){
								field.options[i].selected = selectOption;
							}
						}
					}
					break;
        
        case "contenteditable":
          field.innerHTML = value;
        break;
        
        case "iframe":
          var iframeDoc = field.contentDocument;
          if (iframeDoc){
            var body = iframeDoc.getElementsByTagName('body')[0];
            if (body){
              body.innerHTML = value;
            }
          }
        break;
						
				default:
					//unknown element type
          Lazarus.logger.error("setFieldValue: Unknown field type '"+ Lazarus.Content.getFieldType(field) +"'");
			}
		},
    
    //this has been written as a callback so that we can add checks from the background page later on
    canSaveField: function(field, callback){
      if (!field){
        callback(false);
      }
      else if (Lazarus.Content.kludgeIsFacebookCommentField(field)){
        callback(false);
      }
      else {
        callback(Lazarus.Content.findForm(field) ? true : false);
      }
    },
    
		
		onFocus: function(evt){
    
			var field = Lazarus.Content.findField(evt.target);
      if (field){
        Lazarus.Content.canSaveField(field, function(canSave){
          if (canSave){
            //show the lazarus button
            switch(Lazarus.Content.getFieldType(field)){
              case "password":
                Lazarus.getPref("savePasswords", function(savePasswords){
                  if (savePasswords){
                    Lazarus.Content.showButton(field);
                  }
                });
              break;
              
              case "text":
              case "color":
              case "date":
              case "datetime":
              case "datetime-local":
              case "email":
              case "month":
              case "number":
              case "search":
              case "tel":
              case "time":
              case "url":
              case "week":
              
              case "contenteditable":
              case "textarea":
							case "iframe":
                Lazarus.Content.showButton(field);
              break;
            }
          }
        });
      }
		},
		
		
		fetchSavedFields: function(field, callback){
			var info = Lazarus.Content.getFieldInfo(field);
			
			Lazarus.callBackground("Lazarus.Background.fetchSavedFields", [info, function(fields){
				if (callback){
					callback(fields);
				}
			}]);
		},
    
   
		onBlur: function(evt){
			var field = Lazarus.Content.findField(evt.target);
      if (field){
				Lazarus.Content.cleanupField(field);
			}
      else if (Lazarus.Utils.getTagName(evt.target) == "lazarusbutton"){
        //hide all the buttons
        Lazarus.Content.hideButton(evt.target);
      }
		},
    
    
    cleanupField: function(field){
      //hide the lazarus button
      Lazarus.Content.hideButton(field);
      
      //and close the lazarus menu if it's open,
      //unless the menu now has the focus
      if (field.ownerDocument.lazarusMenu){
        //hmmm, hiding the menu immedately is causing some click events not to fire,
        setTimeout(field.ownerDocument.lazarusMenu.hide, 1);
      }
    },
    
    
		
		showButton: function(ele){
      //var CHECK_SIZE_CHANGE_INTERVAL = 100; //milliseconds
      
			Lazarus.logger.log("show button", ele);
      
      //has the button already been attached to the document?
      var btn = Lazarus.Content.getButtonForField(ele);
      
      //position next to element
      Lazarus.Content.positionButton(btn, ele);
      
      //and show
      //TODO: fadeIn (feels nicer)
      btn.style.display = "block";
		},
    
    
    positionButton: function(btn, ele){
      //by default position btn to the top-right of the the element
      var BUTTON_HEIGHT = 22; //height of lazarus button in pixels
      var rect = ele.getBoundingClientRect();
      
      Lazarus.Utils.setStyle(btn, 'top', (rect.top - BUTTON_HEIGHT) +'px');
      Lazarus.Utils.setStyle(btn, 'left', rect.right +'px');
      
      //TODO: if there is not enough room then position inside the element (top-right)?
    },
    
    getButtonForField: function(field){
      var doc = field.ownerDocument;
      var btns = doc.getElementsByTagName('lazarusbutton');
      if (btns && btns[0]){
        if (btns[0].currentEle === field){
          return btns[0];
        }
        else {
          //destroy the button and make a new one
          return Lazarus.Content.createButton(doc, field);
        }
      }
      else {
        //not found, make a new one
        return Lazarus.Content.createButton(doc, field);
      }
    },
    
    
    removeButtons: function(doc){
      var btns = doc.getElementsByTagName('lazarusbutton');
      for(var i=btns.length-1; i>=0; i--){
        var btn = btns[i];
        btn.parentNode.removeChild(btn); 
      }
    },
    
    createButton: function(doc, field){
      var btn = doc.createElement('lazarusbutton');
      for(var style in Lazarus.Content.btnStyles){
        var value = Lazarus.Content.btnStyles[style].replace("{baseURI}", Lazarus.baseURI);
        Lazarus.Utils.setStyle(btn, style, value);
      }
      btn.title = "Lazarus: Recover Text";
      //adding a tabindex allows us to focus on the custom HTML element
      btn.setAttribute("tabindex", 99999);
      
      //console.log("appending btn to doc", btn, doc);
      doc.documentElement.appendChild(btn);
      Lazarus.Utils.addEvent(btn, 'mouseover', function(){
        btn.style.opacity = 1;
        //btn.style.backgroundPosition = '0px -22px';
      });
      Lazarus.Utils.addEvent(btn, 'mouseout', function(){
        btn.style.opacity = 0.33;
        btn.style.backgroundPosition = '0px 0px';
      });
      Lazarus.Utils.addEvent(btn, 'click', function(evt){
        //show the menu for this element
        Lazarus.Content.showMenu(field, evt);
      });
      Lazarus.Utils.addEvent(btn, 'focus', function(){
        //console.log("btn-focus");
        btn.hasFocus = true;
      });
      Lazarus.Utils.addEvent(btn, 'blur', function(){
        //console.log("btn-blur");
        btn.hasFocus = false;
      });
      
      btn.currentEle = field;
      field.lazarusButton = btn;
      
      return btn;
    },
    
    
    showMenu: function(field, evt){
      
      //console.log("showing menu for field", field);
      
      var doc = field.ownerDocument;
      
      //save the current state of the form so we can restore it if the user doesn't restore a saved form
      var form = Lazarus.Content.findForm(field);
			if (form){
				form.lazarusOrigFormInfo = Lazarus.Content.getFormInfo(form);
				
				var menu = Lazarus.Content.buildMenu(field);
        
				//check if the "restore" functionality requires the user to login
				Lazarus.callBackground("Lazarus.Background.isPasswordRequired", [function(isPasswordRequired){
					if (isPasswordRequired){
						//add an enter password menu item
						menu.addItem(Lazarus.locale.getString("menu.enter.password"), {
							icon:Lazarus.Content.images.lock,
							onclick: function(){
								Lazarus.dialog(Lazarus.baseURI +"login.html", {
									modal: true,
									width: 510,
									height: 210,
									doc: doc,
									callback: function(loggedIn){
										if (loggedIn){
											//show the restore fields menu
                      field.focus();
                      Lazarus.Content.buildRestoreMenuItems(menu, field);
                      //and "click" the lazarus button for this field to show the menu
                      Lazarus.Content.showMenu(field);
										}
										else {
											//just hide the menu
											menu.hide();
											//and re-focus back on the original field
											field.focus();
										}
									}
								})
							}, 
							tooltip: Lazarus.locale.getString("menu.enter.password.tooltip")
						});
						
						//add an options menuitem
						Lazarus.Content.addAdditionalMenuitems(doc.lazarusMenu, field);
					}
					else {
						//just show the restore menu items
            Lazarus.Content.buildRestoreMenuItems(menu, field);
					}
				}]);
      }
    },
    
    
    showDisableDialog: function(doc, domain, callback){
      var url = Lazarus.Utils.urlAdd(Lazarus.baseURI +"disable-on-site.html", {domain: domain});
      Lazarus.dialog(url, {
        modal: true,
        width: 510,
        height: 210,
        doc: doc,
        callback: function(response){
          callback(response);
        }
      })
    },
    
    
    buildMenu: function(ele){
      
      var doc = ele.ownerDocument;
      
      //remove any old menu
      if (doc.lazarusMenu){
        doc.lazarusMenu.remove();
      }
      
      //build the new menu
      doc.lazarusMenu = new Lazarus.Menu();
      doc.lazarusMenu.init(doc);
      
      var btn = Lazarus.Content.getButtonForField(ele);
      Lazarus.Content.positionMenu(doc.lazarusMenu, btn);
      doc.lazarusMenu.show();
      
      return doc.lazarusMenu;
    },
    
    positionMenu: function(menu, ele){
      //and show it next to the element
      //XXX FIXME: make this work on framed pages (especially disqus forms which appear inside iframes!)
      
      var doc = ele.ownerDocument;
      var box = Lazarus.Utils.getBox(ele);
      var docBox = Lazarus.Utils.getBox(doc.documentElement);
      
      //console.log("positionMenu", ele, doc, box, docBox);
      
      //default is to attach the menu to the top right corner of the element,
      //or the bottom left of the <lazarusbutton>
      var x = box.left;
      var y = box.bottom;
        
      if (box.right + menu.width >= docBox.right){
        //if that won't work then we're going to move it to the left so that it actually overlaps the element
        x = box.right - menu.width;
      }
      menu.position(x, y);
    },
    
    
    buildRestoreMenuItems: function(menu, field){
    
      var form = Lazarus.Content.findForm(field);
      var fieldType = Lazarus.Content.getFieldType(field);
      var doc = field.ownerDocument;
      
      //empty the current menu
      menu.removeAll();
      
      //add the loading menuitem
      if (Lazarus.Utils.isLargeTextField(field)){
        //save the current text of this field
        field.lazarusOrigValue = Lazarus.Content.getFieldValue(field);
        menu.addItem(Lazarus.locale.getString("menu.loading.saved.text"), {icon:Lazarus.Content.images.loading});
      }
      else {
        //save the form values
        menu.addItem(Lazarus.locale.getString("menu.loading.saved.forms"), {icon:Lazarus.Content.images.loading});
      }
      
      //add an options menuitem
      Lazarus.Content.addAdditionalMenuitems(menu, field);
      
      //now fetch the saved forms for this element
      if (Lazarus.Utils.isLargeTextField(field)){
        var domain = field.ownerDocument.domain;
        //XXX FIXME: just get summaries of text?
        Lazarus.logger.log("fetching saved text for domain", domain);
        Lazarus.callBackground("Lazarus.Background.fetchSavedText", [domain, function(rs){
          menu.removeAll();
          if (rs.length > 0){
            for(var i=0; i<rs.length; i++){
              Lazarus.Content.addRestoreTextMenuitem(menu, rs[i].text, field);
            }
          }
          else {
            //show no saved forms message
            menu.addItem(Lazarus.locale.getString("menu.no.saved.text"), {
              disabled: true
            });
          }
          //better re-add the options menu item too
          Lazarus.Content.addAdditionalMenuitems(menu, field);
        }]);
      }
      else {
        Lazarus.Content.fetchSavedFields(field, function(rs){
          Lazarus.logger.log("fetchSavedFields", rs);
          //rebuild the menu
          menu.removeAll();
          if (rs.length){
            if (form){
              for(var i=0; i<rs.length; i++){
                Lazarus.Content.addRestoreFormMenuitem(menu, rs[i], form, field);
              }
            }
            else {
              throw Error("Unable to find form from element");
            }
          }
          else {
            //show no saved forms message
            menu.addItem(Lazarus.locale.getString("menu.no.saved.forms"), {
              disabled: true
            });
          }
          //better re-add the options menu item too
          Lazarus.Content.addAdditionalMenuitems(menu, field);
        });
      }
    },
    
    generateTooltip: function(text){
      //only generate a tooltip if the text is long 
      if (text.length > Lazarus.Content.MIN_TEXT_FOR_TOOLTIP){
        return text.substr(0, Lazarus.Content.MAX_TEXT_FOR_TOOLTIP);
      }
      else {
        return '';
      }
    },
    
    //tidy up text and make it usable for a menu item or tooltip
    tidyText: function(text){
      return Lazarus.Utils.htmlToText(text);
    },
    
    addRestoreFormMenuitem: function(menu, rec, form, field){
      
      var tidyText = Lazarus.Content.tidyText(rec.text);
      
      //passwords should not be shown
      if (tidyText && Lazarus.Content.getFieldType(field) == "password"){
        tidyText = tidyText.substr(0, 1) + tidyText.substr(1, tidyText.length-2).replace(/./g, '*') + tidyText.substr(-1, 1);
      }
      
      //add the menuitem to the menu
      var menuitem = menu.addItem(tidyText, {
        data: rec,
        onclick: function(){
          //restore this form
          var onRestoreForm = function(form, restoredFields){
            //better restore ALL the fields original styles
            for(var i=0; i<form.elements.length; i++){
              Lazarus.Content.unhighlightField(form.elements[i]);
            }
            menu.hide();
            field.focus();
            //and move the carot to the end of the new text
            field.selectionStart = field.value.length;  
            
            if (rec.formInfo.editingTime && rec.formInfo.editingTime && rec.formInfo.editingTime){
              Lazarus.logger.log("We just saved you "+ rec.formInfo.editingTime +" seconds of your time");
            }
          }
          
          if (rec.formInfo){
            form.lazarusOrigFormInfo = null;
            Lazarus.Content.restoreForm(form, rec.formInfo, onRestoreForm);
          }
          else {
            //TODO: show loading icon for this menuitem
            Lazarus.callBackground("Lazarus.Background.fetchForm", [rec.formId, function(formInfo){
              if (formInfo){
                //prevent the onmouseout handler (which will fire when the menu dissapears) from restoring the original text
                form.lazarusOrigFormInfo = null;
                Lazarus.Content.restoreForm(form, formInfo, onRestoreForm);
              }
              else {
                Lazarus.msg("error.cannot.find.form", "error")
              }
            }]);
          }
        }
        //tooltip no longer needed because we're showing the text in the form fields anyway
        //tooltip: Lazarus.Content.generateTooltip(tidyText)
      });
      
      // when the user mouses over the menuitem, we want to show the recoverable form fields inside the current form
      Lazarus.Utils.addEvent(menuitem, 'lazarus:hover', function(evt){
        //console.log("lazarus:hover", evt);
        
        if (rec.formInfo){
          Lazarus.Content.showRestoreableFormInfo(form, rec.formInfo);
        }
        else {
          Lazarus.callBackground("Lazarus.Background.fetchForm", [rec.formId, function(formInfo){
            if (formInfo){
              rec.formInfo = formInfo;
              //are we still trying to show this restorable form, or has the user moved their mouse away?
              if (Lazarus.Mouse.isOverEle(menuitem)){
                Lazarus.Content.showRestoreableFormInfo(form, rec.formInfo);
              }
            }
            else {
              Lazarus.msg("error.cannot.find.form", "error")
            }
          }]);
        }
      });
      
      Lazarus.Utils.addEvent(menuitem, 'mouseout', function(){
        if (Lazarus.Utils.isSet(form.lazarusOrigFormInfo)){
          //restore original form values
          Lazarus.Content.restoreForm(form, form.lazarusOrigFormInfo, function(){
            //better restore ALL the fields original styles
            for(var i=0; i<form.elements.length; i++){
              Lazarus.Content.unhighlightField(form.elements[i]);
            }
          });
        }
      });
    },
    
    showRestoreableFormInfo: function(form, formInfo){
      Lazarus.Content.restoreForm(form, formInfo, function(form, restoredFields){
        for(var i=0; i<restoredFields.length; i++){
          Lazarus.Content.highlightField(restoredFields[i]);
        }
      });
    },
    
    
    kludgeIsFacebookCommentField: function(ele){
      var doc = ele.ownerDocument;
      if (doc && doc.domain && /(\.)?facebook\.com$/i.test(doc.domain)){
        return ((Lazarus.Utils.getTagName(ele) == "textarea") && Lazarus.Utils.hasClass(ele, 'enter_submit'));
      }
      else {
        return false;
      }
    },
    
    
    //Facebook is so seriously fragged
    kludgeSetFacebookCommentFieldValue: function(ele, value){
      ele.value = ele.lazarusOrigValue;
      return;
      // var fieldId = ele.getAttribute('id');
      // var keyDownCode = ele.getAttribute('onkeydown');
      
      // //find the associated mentionsHidden input box
      // var mentionsBox = Lazarus.Utils.findParent(ele, function(ele){
        // return Lazarus.Utils.hasClass(ele, 'uiMentionsInput') ? ele : false;
      // });
      
      // var mentionsHidden = Lazarus.Utils.findChildren(mentionsBox, 'input', 'mentionsHidden')[0];
      
      // //we need to update the hidden element with our new value
      // //mentionsHidden.value = value;
      
      // //and the textbox in question
      // //ele.value = value;
      
      // //and (for some reason) rebind the textbox to it's hidden object
      // var getObjCode = "document.getElementById('"+ fieldId +"')";
      // var bindCode = getObjCode +".value='"+ value +"'; "+ keyDownCode.replace(/\bthis\b/g, getObjCode);
      
      // Lazarus.Utils.injectCode(ele.ownerDocument, bindCode);
      
    },
    
    
    addRestoreTextMenuitem: function(menu, text, field){
    
      var tidyText = Lazarus.Content.tidyText(text);
      
      //add the menuitem to the menu
      var menuitem = menu.addItem(tidyText, {
        onclick: function(){
          //console.log("restoring text", text);
          
          //restore the text
          if (Lazarus.Content.kludgeIsFacebookCommentField(field)){
            Lazarus.Content.kludgeSetFacebookCommentFieldValue(field, text);
          }
          else {
            Lazarus.Content.setFieldValue(field, text);
          }
          //prevent the onmouseout handler (which will fire when the menu dissapears) from restoring the original text
          field.lazarusOrigValue = null;
          Lazarus.Content.unhighlightField(field);
          menu.hide();
          field.focus();
          //and move the carot to the end of the new text
          //FIXME: set carot in WYSIWYG editors
          if (typeof field.value == "string"){
            field.selectionStart = field.value.length;
          }
        },
        tooltip: Lazarus.Content.generateTooltip(tidyText)
      });
      
      //when the user mouses over the menuitem, we want to show the current text temporarily inside the textbox
      Lazarus.Utils.addEvent(menuitem, 'mouseover', function(){
        Lazarus.Content.setFieldValue(field, text);
        Lazarus.Content.highlightField(field);
      });
      
      Lazarus.Utils.addEvent(menuitem, 'mouseout', function(){
        if (Lazarus.Utils.isSet(field.lazarusOrigValue)){
          //restore original text
          Lazarus.Content.setFieldValue(field, field.lazarusOrigValue);
          Lazarus.Content.unhighlightField(field);
          field.lazarusCurrTextCreated = null;
        }
      });
    },
    
    
    highlightField: function(field){
      Lazarus.Utils.setStyle(field, 'color', '#999999');
      Lazarus.Utils.setStyle(field, 'backgroundColor', '#FFFFDD');
    },
    
    unhighlightField: function(field){
      Lazarus.Utils.restoreStyle(field, 'color');
      Lazarus.Utils.restoreStyle(field, 'backgroundColor');
    },
    
    
    addAdditionalMenuitems: function(menu, ele){
      menu.addSeparator();
      menu.addItem(Lazarus.locale.getString("menu.options"), {
        onclick: function(){
          Lazarus.callBackground("Lazarus.Background.openOptions");
        }, 
        tooltip: Lazarus.locale.getString("options.tooltip")
      });
      
      var domain = ele.ownerDocument.domain;
      
      menu.addSeparator();
      menu.addItem(Lazarus.locale.getString("disable.domain"), {
        onclick: function(){
          
          //disable this domain
          Lazarus.Content.showDisableDialog(ele.ownerDocument, domain, function(response){
            if (response){
              Lazarus.Content.disableDoc(ele.ownerDocument, ele);
              Lazarus.callBackground("Lazarus.Background.refreshUI");
              if (response == "formsRemoved"){
                Lazarus.msg("disable.domain.removeForms.success", "success", {domain:domain});
              }
              ele.focus();
            }
            else {
              //user hit cancel, do nothing
            }
          });
        }, 
        tooltip: Lazarus.locale.getString("disable.domain.tooltip", {domain:domain})
      });
      
      //if the user is logged in, then add a logout option
      Lazarus.callBackground("Lazarus.Background.isLoggedIn", [function(loggedIn){
        if (loggedIn){
          menu.addSeparator();
          menu.addItem(Lazarus.locale.getString("menu.logout"), {
            onclick: function(){
              Lazarus.callBackground("Lazarus.Background.logout", [function(){
                menu.hide();
                //hide the button for this field
                ele.blur();
              }]);
            }, 
            tooltip: Lazarus.locale.getString("menu.logout.tooltip"),
            icon: Lazarus.Content.images.lock
          });
        }
      }]);
    },
    
    
    
    hideButton: function(ele, force){
    
      //if a user clicks on the button to open the menu then the button 
      //will disappear before the click event fires.
      //we should leave the button where it is if the user clicks on our button
      //console.log("activeElement", ele.ownerDocument.activeElement);
      var doc = ele.ownerDocument;
      
      setTimeout(function(){
        //hiding the button when the field looses the focus 
        var btns = doc.getElementsByTagName('lazarusbutton');
        
        if (btns){
          for(var i=btns.length -1; i>=0; i--){
            var btn = btns[i];
            if (btn.currentEle != doc.activeElement && !btn.hasFocus){
              btns[i].parentNode.removeChild(btns[i]);
            }
          }
        }
      }, 1);
    },
    
		
		findField: function(ele){
      var type = Lazarus.Content.getFieldType(ele);
      if (type){
        return ele;
      }
      else {
        
        if (Lazarus.Utils.isContentEditableIframe(ele)){
          //if the element is a document
          var NODE_TYPE_DOCUMENT = 9;
          var doc = (ele.nodeType == NODE_TYPE_DOCUMENT) ? ele : ele.ownerDocument;
          return doc.defaultView.frameElement;
        }
        else {
          //look for content editable divs.
          var editableEle = Lazarus.Utils.findParent(ele, function(ele){
            //if this node is editable, but the parent is not then we have found the editable root node
            if (ele.isContentEditable && (!ele.parentNode || !ele.parentNode.isContentEditable)){
              return ele;
            }
            else {
              return false;
            }
          });
          
          return editableEle ? editableEle : null;
        }
      }
		},
		
		
		onKeyUp: function(evt){
			
			//fetch the textbox from this event
      var field = Lazarus.Content.findField(evt.target);
      if (field){
				var fieldType = Lazarus.Content.getFieldType(field);
        
        if (Lazarus.Content.isTextFieldType(fieldType)){
          if (fieldType == "password"){
            Lazarus.getPref("savePasswords", function(savePasswords){
              if (savePasswords){
                Lazarus.Content.restartAutosaveTimer(field);
              }
            });
          }
          else {
            Lazarus.Content.restartAutosaveTimer(field);
          }
        }
				var form = Lazarus.Content.findForm(field);
        if (form){
          Lazarus.Content.restartEditTimer(form);
        }
			}
		},
    
    
    restartEditTimer: function(form){
      form.lazarusLastEditTime = Lazarus.Utils.timestamp();
      if (!form.lazarusStartEditTime){
        form.lazarusStartEditTime = Lazarus.Utils.timestamp();
      }
      //console.log("restartEditTimer", form.instanceId, form.lazarusEditTimer, Lazarus.Content.EDITING_IDLE_TIME);
      if (form.lazarusEditTimer){
        clearTimeout(form.lazarusEditTimer);
      }
      form.lazarusEditTimer = setTimeout(function(){
        Lazarus.Content.stopEditTimer(form);
      }, Lazarus.Content.EDITING_IDLE_TIME);
    },
    
    
    stopEditTimer: function(form){
      //console.log("stopEditTimer", form);
      if (form.lazarusEditTimer){
        clearTimeout(form.lazarusEditTimer);
      }
      //tally up the edit time
      form.lazarusTotalEditTime = form.lazarusTotalEditTime || 0;
      if (form.lazarusStartEditTime){
        form.lazarusTotalEditTime += (form.lazarusLastEditTime - form.lazarusStartEditTime);
        form.lazarusStartEditTime = 0;
      }
      return form.lazarusTotalEditTime;
    },
    
    
    getEditTime: function(form){
      //return the total elapsed edit time for a given form
      var totalEditTime = form.lazarusTotalEditTime || 0;
      if (form.lazarusStartEditTime && form.lazarusLastEditTime){
        totalEditTime += (form.lazarusLastEditTime - form.lazarusStartEditTime);
      }
      return totalEditTime;
    },
    
    //return TRUE if the given field is a single line, or multiline textbox 
    //NOTE: this includes richtext and HTML5 textual input types
    isTextFieldType: function(fieldType){
    
      switch(fieldType){
        case "text":
        case "color":
        case "date":
        case "datetime":
        case "datetime-local":
        case "email":
        case "month":
        case "number":
        case "range":
        case "search":
        case "tel":
        case "time":
        case "url":
        case "week":
        case "textarea":
        case "password":
        case "iframe":
        case "contenteditable":
          return true;
        break;
        
        default:
          return false;
        break;
      }
    },
    
    
    shouldSaveValue: function(val){
      return Lazarus.Utils.stripTags(val) ? true : false;
    },
    
    
    restartAutosaveTimer: function(field){
      clearTimeout(Lazarus.Content.autosaveTimer);
      Lazarus.Content.autosaveTimer = setTimeout(function(){
        //need to check if field still exists?
        if (Lazarus.Content.fieldExists(field)){
          //and the field actually has a value
          var val = Lazarus.Content.getFieldValue(field);
          if (Lazarus.Content.shouldSaveValue(val)){ 
            Lazarus.Content.autosave(field);
          }
        }
      }, Lazarus.Content.autosaveDelay);
    },
    
    
    fieldExists: function(field){
      //XXX TODO: detect if the field and it's document still exist?
      return true;
    },
		
		
		restoreForm: function(form, formInfo, callback){
		
			//save the current form state so we can restore it later if we need to.
			if (!form.lazarusOrigFormInfo){
				form.lazarusOrigFormInfo = Lazarus.Content.getFormInfo(form);
			}
      
			//fetch the values for this form.
			Lazarus.logger.log("restoring form...");
			
			//some forms have multiple elements with the same name (think radiogroups or php forms with multiple textboxes called "names[]")
			//for these fields we're going to have to check their value to see if it matches ours
			//we are going to be altering some of the formInfo fields, so we should work on a copy of it, not the original
			formInfo = Lazarus.Utils.clone(formInfo);
			
			Lazarus.getPref("savePasswords", function(savePasswords){
				
        var restoredFields = [];
				for(var i=0; i<form.elements.length; i++){
					var field = form.elements[i];
					var fieldInfo = Lazarus.Content.getFieldInfo(field);
					if (fieldInfo){
						//find the matching fieldInfo
						for(var j=0; j<formInfo.fields.length; j++){
							var savedFieldInfo = formInfo.fields[j];
							if (!savedFieldInfo.restored && savedFieldInfo.name == fieldInfo.name && savedFieldInfo.type == fieldInfo.type){
								//special case, checkboxes
								switch(fieldInfo.type){
									case "text":
                  case "color":
                  case "date":
                  case "datetime":
                  case "datetime-local":
                  case "email":
                  case "month":
                  case "number":
                  case "range":
                  case "search":
                  case "tel":
                  case "time":
                  case "url":
                  case "week":
                  
									case "textarea":
									case "select":
										Lazarus.Content.setFieldValue(field, savedFieldInfo.value);
										savedFieldInfo.restored = true;
                    restoredFields.push(field);
									break;
									
									case "password":
										if (savePasswords){
											Lazarus.Content.setFieldValue(field, savedFieldInfo.value);
                      restoredFields.push(field);
                      savedFieldInfo.restored = true;
										}
										else {
                      //DONT add this field to the restored fields
											//Lazarus.Content.setFieldValue(field, "");
										}
									break;
									
									case "radio":
									case "checkbox":
										if (fieldInfo.value && (fieldInfo.value.valueAttr == savedFieldInfo.value.valueAttr)){
											Lazarus.Content.setFieldValue(field, savedFieldInfo.value.checked);
											savedFieldInfo.restored = true;
                      restoredFields.push(field);
										}
									break;
								}
                //and stop looking for matching fields
                continue;
							}
						}
					}
				}
				//mark the form as currently showing a saved form.
				form.lazarusCurrFormId = formInfo.id || null;
				Lazarus.logger.log("form restored "+ (formInfo.id || "original"));
        if (callback){
          callback(form, restoredFields);
        }
			});
		},
		
		
		
		/**
		* return a form from an element
		**/
		findForm: function(ele, eleIsField){
      
			var form = Lazarus.Utils.findParent(ele, function(ele){
        if (ele.nodeName.toLowerCase() == "form"){
          return ele;
        }
        else if (ele.form){
          return ele.form;
        }
        else {
          return false;
        }
      });
      
      if (form){
        if (eleIsField){
          //make sure the field element exists within the form
          for(var i=0; i<form.elements.length; i++){
            if (form.elements[i] === ele){
              //all good, return form
              return form;
            }
          }
          //bugger, field not found in form, make a fake form and return that instead
          return new Lazarus.Content.FakeForm(ele);
        }
        else {
          return form;
        }
      }
      //support non-form textareas and WYSIWYGs 
      else if (Lazarus.Utils.isLargeTextField(ele)){
        //create a fake form?
        return new Lazarus.Content.FakeForm(ele);
      }
      else {
        return null;
      }
		},
    
		
		isTextarea: function(ele){
      return (ele && ele.nodeName && ele.nodeName.toLowerCase() == "textarea");
    },
    
    images: {
      button: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALHRFWHRDcmVhdGlvbiBUaW1lAEZyaSAxMiBOb3YgMjAxMCAxOTowNzowMiArMTIwMOGr8p4AAAAHdElNRQfaCwwGBxwduq16AAAACXBIWXMAAAsSAAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAAfJJREFUeNqVkk1vElEUhp87X4CIFhhMG0toMC5K3Lgxbro10bhxY2Jc+CO666Y/oP/DxFVjTKM7l1apTdM0JSU0LSg0WqaUjwE6MDNebGpKBYlndc+55zw5H6/gim2UUd0qs5Uy6VaTa7EYdtOmUN7naHER92q+dtnZ2UFpHTOTXWfuwxrfYlNUHz1lxvdIVyx6MuXHPwFeBLW2z+29Pepr7ziUof7SEq1CibCEmKMAymXH6SD6LrpzRndQPIjNz9P3odu2URlhQ4C+ghcM0JpLEchkzrv7eIDS62JYP2lPBJS2cIMhyrMpwo+fMbW8jLhhc2t3F906pjoK8GcH29vonoenRDk1m5zcvUM6ZuJvZEnmcljT09hbR6iVIuLJw/PxhgAOPOj26Gk1nEQCNWAQ7XS4bxvw8hWuGedeo4iR+/y7+OtfgM1N9OIBwnFQ5SLdZJJ2JML17BdqEuYHgmiahsjnx4zw/i2fslm8dht/YQHx/AWpfI50/ZTKm9d8lykiHkf4/hjA6ipnF++VFRS7T1AoaDejyCEYlHmWNeEKF9YISz30CBkGirxKUIZGamAsQG2hux66BAipi1A6g/5fAM/HkGrUFfmr6wSSiWHJTwQoPrq8hCYEGDoh0xzfwUhyIY9ROkRrNKQ65e1P6uM7+AW+ibcHEM1ixAAAAABJRU5ErkJggg==',
      
      loading: 'data:image/gif;base64,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',
    
      //http://jonasraskdesign.com
      lock: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALHRFWHRDcmVhdGlvbiBUaW1lAFN1biAyMSBOb3YgMjAxMCAwOTozNzoyNSArMTIwMO4evnUAAAAHdElNRQfaCxQUJiOtTJ3KAAAACXBIWXMAAAsSAAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAAoJJREFUeNqFU89PE0EYfbO7dH+0tFLAiEYOxAOoiUgvHjj4F3jRxDuJeuBCOHlRD6BH0gtejCHh1hAvphIOxERDvCnIhcaQWIFCW8lqt91t9+f47QZrEYxfMjuZnfe99837ZoDTQ1paWnq+tbXFwzisVPjrfH4lk8n04X8xOzs7WqaEML4Wi3xleZl/3tiI1rquc9of68SzzsX4+HjP/Py8PjI8jIWFBRyUy0ilUus/a7XrmqpiamoKhUIBk5OT6bW1tR8n1BcXF58WSfXt6iqfm5s76NzLZrMz+Xye7+3s8FwuN/P7v9AJSvf23pYEAXqthunp6YHOPVJ/REdwHc+Dpml3TiUQRKVHVLoRjyeN0/zp7ulvSXICTFLTbbePGVL50GWXbMSsfUHPXh48vPbgfJeUhKtXEP/0cL/g7TJeDsC+b7bz2iauzwy+HL37bMKsbkPWEpCGMoB6liRkwKkDjQO4xY+wrRbifUPYePXkxdjjvfttppiiTiB5DkL1DWA34e+WwGJEIMjgQR3MKoHb3yAiCdZ3E4qi3qO0PwRGy6ZvA6Jag2404TYrYGKNahSBwEHgm5C5hdSZEF0/wnd4YDYdjoAzxzKgyAFUySJ1N/KZcQ9B4AGuC7tlIuYTRdPlxwnqLgJqkW004Ap0Y2WSYmQRp8ECmnnkhejriBPOarh/VWD5CKgq2wigl9/BC5SoyUJEwOETRxdrIT1whXA8wh8nMF34doB6xYSmjkBKXiBVygI/6pcIzyihXjXRSzjT9NoEcjgzjzFZTUBrKTC3N+kYmycuUsgXH7wKmS6T6IWlRYeERuPijX7cSji4RF3yhNi/Xys1JGyC5MTw5X0VuV8SYTGwRfA/ngAAAABJRU5ErkJggg=='
    },
    
    
    FakeForm: function(ele){
      this.elements = [ele];
      ele.form = this;
      this.ownerDocument = ele.ownerDocument;
      this.action = ele.ownerDocument.URL;
      this.method = 'POST';
    }
	}
	
})();


