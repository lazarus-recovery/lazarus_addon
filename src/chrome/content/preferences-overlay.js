
/**
* 
*/
Lazarus.initClearNowButton = function(){
    //it appears the "clearDataNow" button doesn't appear until the 
    //privacy pane is selected, soooo
    
    if (Lazarus.$("clearDataNow")){
        Lazarus.$("clearDataNow").addEventListener("command", Lazarus.onClearNow, false);
    }
    else {
        Lazarus.$("panePrivacy").addEventListener("paneload", Lazarus.initClearNowButton, false);
    }
}

/**
* clearDataNow button has been pushed.
*/
Lazarus.onClearNow = function(evt){
    //only fire the event if not privacy.sanitize.promptOnSanitize
    Lazarus.getBrowser().Lazarus.fireClearPrivateDataIfNoPrompt();
}

window.addEventListener("load", Lazarus.initClearNowButton, false);

//refresh the statusbar icon (if the user has set/unset their password)
window.addEventListener("unload", Lazarus.getBrowser().Lazarus.refreshIcon, false);
