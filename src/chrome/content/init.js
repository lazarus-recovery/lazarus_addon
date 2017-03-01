
Lazarus.Event.init();

/**
* startup function, initalises the add-on for this window
*/
Lazarus.Event.add("window-load", function(){
    //Lazarus.init();
    //use setTimeout so we don't slow down the UI when initalizing Lazarus
    setTimeout(Lazarus.init, 500);
});

Lazarus.Event.add("window-unload", Lazarus.cleanup);

Lazarus.Event.add("lazarus-installed", Lazarus.showWelcome);
Lazarus.Event.add("lazarus-updated", Lazarus.runUpdates);
Lazarus.Event.add("lazarus-updated", Lazarus.showUpdatePage);
