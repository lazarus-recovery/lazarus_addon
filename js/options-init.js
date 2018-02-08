if (Lazarus.platform.id == "safari"){
  gEvent.init("content");
}

$(window).load(function(){
	Lazarus.Options.init();  
});
