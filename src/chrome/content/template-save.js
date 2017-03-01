

var gArgs = window.arguments[0];

//this is a modal dialog so we should be safe to use the openers getstring method
//to translate strings.
Lazarus.getString = Lazarus.getBrowser().Lazarus.getString;

/**
* 
*/
function init(){
    moveToAlertPosition(); 
    initTemplateNames();
    //WYSIWYG and AJAX textarea cannot be autofilled at this time
    if (gArgs.isTextarea || gArgs.isIframe){
        Lazarus.$('template-autofill').disabled = true;
        Lazarus.$('template-autofill').setAttribute("tooltiptext", Lazarus.getString("template.save.autofill.disabled"));
    }
}


/**
* fill the template-names menu with the known names.
*/
function initTemplateNames(){
    var menu = Lazarus.$('template-names');
    for (var i=0; i<gArgs.templateNames.length; i++){
        var name = gArgs.templateNames[i];
        var menuitem = document.createElement("menuitem");
        menuitem.setAttribute("value", name);
        menuitem.setAttribute("label", name);
        menu.appendChild(menuitem);
    }
    
    //suggest a default name for this template.
    Lazarus.$('template-name').value = gArgs.defaultName;
}



/**
* handle user selecting "save"
*/
function onOK() {
    
    var templateName = Lazarus.trim(Lazarus.$('template-name').value);
    if (!templateName){
        alert(Lazarus.getString("template.save.template.name.required"));
        //restore focus to textbox
        Lazarus.$('template-name').select();
        return false;
    }
    //confirm if we are overwriting a known form
    else if (!Lazarus.inArray(templateName, gArgs.templateNames) || confirm(Lazarus.getString("template.save.confirm.overwrite", templateName))){
        gArgs.templateName = templateName;
        gArgs.autofill = Lazarus.$('template-autofill').checked;
        return true;
    }
    //name is already used, end user hit "cancel" on confirm overwrite dialog
    else {
        //don't close the dialog
        return false; 
    }
}

