
Lazarus.db = Lazarus.getBrowser().Lazarus.db;
Lazarus.Crypto = Lazarus.getBrowser().Lazarus.Crypto;

function init(){
    if (!Lazarus.getBrowser().Lazarus.isPasswordSet()){
        //disable the Current password box
        document.getElementById('previous').hidden = true;
        document.getElementById('previous-disabled').hidden = false;
    }
    else {
        document.getElementById('previous').hidden = false;
        document.getElementById('previous-disabled').hidden = true;
    }
}


function refreshButtons(){
    var btnAccept = document.getElementsByTagName('dialog')[0].getButton('accept');
    btnAccept.disabled = (document.getElementById('password').value != document.getElementById('confirm').value);
}

/**
* 
*/
function onAccept(){
    //re-encrypt the private key with the new password.
    var previousBox = document.getElementById('previous');
    var passwordBox = document.getElementById('password');
    var confirmBox = document.getElementById('confirm');
    
    var encb64Key = Lazarus.db.getStr("SELECT value FROM settings WHERE name = 'private-key'");
    //we need to unencrypt the private key
    var decb64Key = Lazarus.Crypto.AESDecrypt(encb64Key, previousBox.value);

    //incorrect old password
    if (!decb64Key){
        alert(strings["error-incorrect-password"]);
        previousBox.value = '';
        return false;
    }
    //passwords don't match
    else if (passwordBox.value != confirmBox.value){
        alert(strings["error-password-mismatch"]);
        passwordBox.value = '';
        confirmBox.value = '';
        passwordBox.focus();
        return false;
    }
    //same password as before
    else if (previousBox.value == passwordBox.value){
        return true;
    }
    //password changed 
    else {
        //re-encrypt the private key with the new password, and save it.
        var newb64Key = Lazarus.Crypto.AESEncrypt(decb64Key, passwordBox.value);
        
        //and save
        Lazarus.db.exe("DELETE FROM settings WHERE name = 'private-key'");
        Lazarus.db.exe("INSERT INTO settings (name, value) VALUES ('private-key', ?1)", newb64Key);
        //since we've changed the password, we'd better log the user out 
        Lazarus.getBrowser().Lazarus.unloadPrivateKey(); 
        
        //if the user has removed the password, then log em in again
        if (passwordBox.value == ''){
            Lazarus.getBrowser().Lazarus.loadPrivateKey();
            //and remove the password from the SSD if it exists
            Lazarus.getBrowser().Lazarus.removePassword();            
        }
        //if the user has his password stored in the Software Security Device, then we should update that as well.
        else if (previousBox.value && Lazarus.getBrowser().Lazarus.loadPassword() == previousBox.value){
            Lazarus.getBrowser().Lazarus.savePassword(passwordBox.value);
        }
        return true;
    }
}


