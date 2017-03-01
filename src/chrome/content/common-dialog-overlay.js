

window.addEventListener("dialogaccept", function(){
    var browser = Lazarus.getBrowser();
    if (browser){
        //the user isn't logged in until the dialog is closed, so we'll need to wait a moment
        //until the login code has run
        //we cannot use setTimeout() on this dialog window, as this window will no longer exist
        //once it has closed.
        browser.setTimeout(function(){
            //attempt to login Lazarus
            browser.Lazarus.loadPrivateKey();
            browser.Lazarus.refreshIcon();
        }, 100);
    }
}, true);
