
/**
* Lazarus Cryptography
* We will use hybrid encryption when saving data to the database.
* this should allow us to encrypt forms with the public key and only require the user to 
* enter their password when they want to retrieve a form.
* 
* Both the public and private (RSA) keys should be kept in the database.
* The public key is kept unencrypted, but the private key will be symetrically encrypted (AES)
* using the users password.
*/


/**
* retrieve the public key from the lazarus database
*/
Lazarus.loadPublicKey = function(){
	if (!Lazarus.Crypto.publicKey){
		var b64Key = Lazarus.db.getStr("SELECT value FROM settings WHERE name = 'public-key'");
		if (b64Key){
			Lazarus.Crypto.publicKey = Lazarus.keyFromString(b64Key);	
		}
	}
	return Lazarus.Crypto.publicKey ? true : false;
}

/**
* attempt to load the private key
*/
Lazarus.loadPrivateKey = function(password){

	if (typeof(password) === 'undefined'){
		password = Lazarus.loadPassword();
	}
	
	if (!Lazarus.Crypto.privateKey){
		var encb64Key = Lazarus.db.getStr("SELECT value FROM settings WHERE name = 'private-key'");
		
		//we need to unencrypt the private key
		Lazarus.Crypto.isPasswordEntered = (password) ? true : false;
		var b64Key = Lazarus.Crypto.AESDecrypt(encb64Key, password);
		if (b64Key){
			Lazarus.Crypto.privateKey = Lazarus.keyFromString(b64Key);	
		}
	}
	return Lazarus.Crypto.privateKey ? true : false;
}

Lazarus.unloadPrivateKey = function(){ 
	Lazarus.Crypto.isPasswordEntered = null;
	Lazarus.Crypto.privateKey = null;
}

Lazarus.initEncryptionKeys = function(){
	if (Lazarus.loadPublicKey()){
		//attempt to load the private key as well (this will fail if the user is not logged in, but thats ok)
		Lazarus.loadPrivateKey();
		return true;
	}
	else {
		//using setTimeout so that firefox can continue to load if we need to generate keys (eg first run)
		setTimeout(function(){
			//FRAK: key generation requires that a user is logged in to the Software Security Device (if they have a master password set!)
			//Bugger, this is exactly what we were trying to avoid with the hybrid encryption stuff in the first place!
			if (Lazarus.isMasterPasswordRequired()){
				Lazarus.openGenerateKeysDialog();				
				if (Lazarus.reloadKeys()){
					Lazarus.enable();
				}
			}
			else {
				Lazarus.generateEncryptionKeys();
				Lazarus.enable();
			}
		}, 1);
		return false;
	}
}

Lazarus.reloadKeys = function(){
	Lazarus.Crypto.publicKey = null;
	Lazarus.unloadPrivateKey();
	Lazarus.loadPrivateKey();
	return Lazarus.loadPublicKey();
}

/**
* generate the public/private key pair and save them to the database.
*/
Lazarus.generateEncryptionKeys = function(){

	Lazarus.Crypto.generatingKeys = true;
	Lazarus.refreshIcon();	
	
	//Key generation can take a long time (up to 30 seconds on an old machine)
	//so we'll do it in a background thread
	var keyPair = null;
	var generateKeysThreadComplete = false;
	var keyPair = Lazarus.Crypto.generateRSAKeyPair();
	var success = false;
	if (keyPair){
		//now save to the database
		//keys have been generated, time to save them to the database.
		Lazarus.db.exe("DELETE FROM settings WHERE name = 'public-key'");
		Lazarus.db.exe("INSERT INTO settings (name, value) VALUES ('public-key', ?1)", Lazarus.keyToString(keyPair.publicKey));
		
		Lazarus.db.exe("DELETE FROM settings WHERE name = 'private-key'");
		Lazarus.db.exe("INSERT INTO settings (name, value) VALUES ('private-key', ?1)", Lazarus.Crypto.AESEncrypt(Lazarus.keyToString(keyPair.privateKey), ""));
		
		//and truncate the forms table as all previous forms will no longer be able to be decrypted
		Lazarus.emptyDB();
		success = true;
	}
	else {
		//FIXME: this is a FATAL error, user should be informed
		Lazarus.error("Failed to generate key pair!");
		Lazarus.disable();
		success = false;
	}
	
	Lazarus.Crypto.generatingKeys = false;
	Lazarus.reloadKeys();
	Lazarus.refreshIcon();  
	return success;
}


Lazarus.keyToString = function(key){
	return btoa(Lazarus.JSON.encode(key));
}

Lazarus.keyFromString = function(base64Str){
	return Lazarus.JSON.decode(atob(base64Str));
}
