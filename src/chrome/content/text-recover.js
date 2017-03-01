

Lazarus.getString = Lazarus.getBrowser().Lazarus.getString;
Lazarus.db = Lazarus.getBrowser().Lazarus.db;
Lazarus.decrypt = Lazarus.getBrowser().Lazarus.decrypt;

LazarusTextRecover = {
    
    init: function(){
        var errMsg = ''
        window.removeEventListener("load", LazarusTextRecover.init, true);
				var id = Lazarus.getUrlQuery(window.location.href, 'id');
				var table = Lazarus.getUrlQuery(window.location.href, 'table');
				
				if (!id){
					errMsg = Lazarus.getString('LazarusTextRecover.noIdGiven');    
				}
        //load the text
				else if (table == "textdata"){
            var text = Lazarus.decrypt(Lazarus.db.getStr("SELECT text_encrypted FROM textdata WHERE id = ?1", id));
            if (text){
                Lazarus.$('text').value = text;
                Lazarus.$('iframe').contentWindow.document.body.innerHTML = text;
                if (!text.match(/<\w+/)){
                    //hide the html tab
                    //hmmm hiding just the one tab makes the next tab look silly (bits are missing from the side)
                    //Lazarus.$('tab-html').hidden = true;
                    //so we're going to hide all the tabs instead.
                    Lazarus.$('tabs').hidden = true;
                    Lazarus.$('tabbox').selectedTab = Lazarus.$('tab-text');
                }
            }
            else {
                errMsg = Lazarus.getString('LazarusTextRecover.textNotFound');
            }
        }
				else if (table == "forms"){
						var json = Lazarus.decrypt(Lazarus.db.getStr("SELECT forminfo FROM forms WHERE id = ?1", id));
						
            if (json){
								//decode the forminfo json object
								var forminfo = Lazarus.JSON.decode(json);
								
								if (forminfo){
									var text = forminfo.formtext;
									Lazarus.$('text').value = text;
									Lazarus.$('iframe').contentWindow.document.body.innerHTML = text;
									if (!text.match(/<\w+/)){
											//hide the html tab
											//hmmm hiding just the one tab makes the next tab look silly (bits are missing from the side)
											//Lazarus.$('tab-html').hidden = true;
											//so we're going to hide all the tabs instead.
											Lazarus.$('tabs').hidden = true;
											Lazarus.$('tabbox').selectedTab = Lazarus.$('tab-text');
									}
								}
								else {
									errMsg = Lazarus.getString('error.form.db.corrupt');
								}
            }
            else {
                errMsg = Lazarus.getString('LazarusTextRecover.textNotFound');
            }
				}
        else {
					errMsg = Lazarus.getString('LazarusTextRecover.noTableGiven');    
        }
        
        if (errMsg){
            setTimeout(function(){
                alert(errMsg);
                window.close();
            }, 1);
        }
    },
    
    copyToClipboard: function(){
        
        try {
            //if the user is looking at the source view, then we need to only copy the plain text
            if (Lazarus.$('tabbox').selectedTab == Lazarus.$('tab-text')){
                Lazarus.Clipboard.setText(Lazarus.$('text').value)
            }
            else {
                Lazarus.Clipboard.setHTML(Lazarus.$('iframe').contentWindow.document.body.innerHTML);
            }
            window.close();
        }
        catch(e){
            alert(Lazarus.getString("LazarusTextRecover.copyToClipboardFailed"));
        }
    },
    
    
    doCommand: function(cmd, event){
        //make sure the focus is set to the right element                               
        var controller = document.commandDispatcher.getControllerForCommand(cmd);
        controller.doCommand(cmd);
        event.stopPropagation();
    }
}

window.addEventListener("load", LazarusTextRecover.init, true);