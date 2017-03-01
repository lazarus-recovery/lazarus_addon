
Lazarus.Clipboard = {

    /**
    * copies text to the clipboard
    */
    setText: function(text){
        var clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper); 
        clipboardHelper.copyString(text);
    },
    
    
    /**
    * 
    */
    setHTML: function(html){
    
        // generate the text version of the html
        var text = html.replace(/<(\/)?\w+[^>]*>/g, ' ').replace(/ +/g, ' ');
        
        //convert to unicode String
        var nsiStringText = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);  
        nsiStringText.data = text;
        
        //convert the HTML  
        var nsiStringHTML = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);  
        nsiStringHTML.data = html;           

        // add Unicode & HTML flavors to the transferable widget  
        var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);  
        trans.addDataFlavor("text/unicode");  
        trans.setTransferData("text/unicode", nsiStringText, text.length * 2); // *2 because it's unicode  

        trans.addDataFlavor("text/html");  
        trans.setTransferData("text/html", nsiStringHTML, html.length * 2); // *2 because it's unicode   

        // and copy to clipboard
        var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);  
        clipboard.setData(trans, null, Components.interfaces.nsIClipboard.kGlobalClipboard);  
    }
}
