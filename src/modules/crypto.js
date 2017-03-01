
var EXPORTED_SYMBOLS = ["Crypto"];

var Crypto = {

	AES: Components.utils.import("resource://lazarus/aes.js").AES,  
	
	RSA: Components.utils.import("resource://lazarus/rsa.js").RSA,  

	//global variable to hold the public and private keys
	publicKey: null,
	privateKey: null,
	
	//flag to indicate if we are currently generating RSA keys
	generatingKeys: false,
	
	//flag: has the user entered their password?
	isPasswordEntered: false,
	
	
	/**
	* Hybrid encrypts a string with the given 
	*/
	encrypt: function(str, keyLength){
		
		keyLength = keyLength || 16;
		
		var randKey = randomStr(keyLength);
		
		//encrypt the data with the random key
		var encData = Crypto.AES.encrypt(str, randKey);
		
		//and encrypt the key with our public/private key encryption
		var encKey = Crypto.RSA.encrypt(randKey, Crypto.publicKey);
		
		//and return the encrypted key with the data
		
		//first byte is the length of the encrypted key
		var ch = String.fromCharCode(encKey.length);
		
		return ch + encKey + encData;
	},
	
	decrypt: function(encrypted){
		
		//first byte is the length of the encrypted key
		var len = encrypted.charCodeAt(0);
		
		var encKey = encrypted.substr(1, len);
		var encMsg = encrypted.substr(len + 1);
			
		//decode the random key
		var randKey = Crypto.RSA.decrypt(encKey, Crypto.privateKey);
		
		//if we are attempting to decode something that has been encrypted with 
		//another key, then it will fail (randKey === null)
		
		//then decode the message
		return randKey ? Crypto.AES.decrypt(encMsg, randKey) : null;
	},
	
	AESEncrypt: function(str, password){
		return Crypto.AES.encrypt(str, password);        
	},
	
	AESDecrypt: function(encStr, password){
		return Crypto.AES.decrypt(encStr, password) || false;  
	},
	
	generateRSAKeyPair: function(bits, publicExponent){
		return Crypto.RSA.generateKeyPair(bits, publicExponent);
	},
	
	
	pack: function(key){
		return btoa(JSON.stringify(key));
	},
	
	unpack: function(packedKey){
		try {
			return JSON.parse(atob(packedKey));
		}
		catch(e){
			return null;
		}
	}
}; 
  

// private


/**
* generate a string of random ascii characters of a given length 
*/
function randomStr(len){
	var str = '';
	for (var i=0; i<len; i++){
			//use acsii characters from 32-126
			var ch = Math.floor(Math.random() * (126 - 32)) + 32;
			str += String.fromCharCode(ch);
	}
	return str;
}
