
this.Lazarus = this.Lazarus || {};

/**
* 
*/
Lazarus.init = function(){
    
    //Kludge: move our checkbox beneath the "Save form and search history" checkbox
    //have tried to do this using xul:insertafter attribute, but it fails.
    var lazBox = Lazarus.$('extensions.lazarus.privacy.item.saved.forms.checkbox');
    
    var checkboxes = document.getElementsByTagName("checkbox");
    for (var i=0; i<checkboxes.length; i++){
        var box = checkboxes[i];
        if (box.getAttribute("preference") == "privacy.item.formdata" && box.nextSibling){
            box.parentNode.insertBefore(lazBox, box.nextSibling);
            return;
        }
    }
    
    //if not found, leave at end of list.
}

window.addEventListener("load", Lazarus.init, false);