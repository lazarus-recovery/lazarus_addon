

Lazarus.db = Lazarus.getBrowser().Lazarus.db;
Lazarus.Crypto = Lazarus.getBrowser().Lazarus.Crypto;

/**
* 
*/
function onAccept(){
    
    //and dont let them cancel it 
    //document.getElementById('').disabled = true;    
    if (Lazarus.getBrowser().Lazarus.enterMasterPassword()){  
        //okey dokey, lets do it.
        //better tell the user that this might take a while
        document.getElementById('generate-keys-progress').style.visibility = "visible";
        document.getElementById('generate-keys-text').style.visibility = "visible";
        
				if (Lazarus.getBrowser().Lazarus.generateEncryptionKeys()){
					alert(strings['keys-generated']);
				}
				else {
					alert(strings['key-generation-error']);
				}
				//and close the dialog
				return true;
    }
    else {
        alert(strings['password-not-entered']);
        return false;
    }
}


/**
* 
*/
function onCancel(){
    alert(strings['key-generation-cancelled']);
}
