
/**
* 
*/
function onLoad(){
    sizeToContent();
		Lazarus.getVersionStr(function(str){
			Lazarus.$("lazarus-version").setAttribute("value", str +" ["+ Lazarus.build +"]"); 
		})
}
