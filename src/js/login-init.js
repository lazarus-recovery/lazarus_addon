

Lazarus.environment = "content";

if (Lazarus.platform.id == "safari"){
  gEvent.init("content");
}
//hmmm, interesting 
//jQuery doesn't fire the onload event inside the XUL options dialog, nor any chrome:// based page (even html ones)
//$(Lazarus.Options.init); //fails :(

$(window).load(function(){
	Lazarus.Login.init();
});