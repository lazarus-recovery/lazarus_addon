

Lazarus.db = Lazarus.getBrowser().Lazarus.db;
Lazarus.Crypto = Lazarus.getBrowser().Lazarus.Crypto;

/**
* 
*/
function onAccept(){
    //okey dokey, lets do it
    if (Lazarus.getBrowser().Lazarus.enterMasterPassword()){  
        //better tell the user that this might take a while
        document.getElementById('resetting-password-progress').style.visibility = "visible";
        document.getElementById('resetting-password-text').style.visibility = "visible";
        if (Lazarus.getBrowser().Lazarus.generateEncryptionKeys()){
					alert(strings['password-reset']);
				}
				else {
					alert(strings['password-reset-error']);
				}
				//and close the dialog
				return true;
    }
    else {
        alert(strings['password-not-entered']);
        return false;
    }
}
