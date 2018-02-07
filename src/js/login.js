

Lazarus.Login = {
  init: function(){
  
		Lazarus.getPref('debugMode', function(debugMode){

			Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
			Lazarus.logger.log("initializing login page");
			
      Lazarus.locale.localiseDOM(document);
			
			$('#password-form').submit(function(){
				
				var password = $.trim($('#password').val());
				if (password){
					//attempt to login with the password provided
					Lazarus.callBackground("Lazarus.Background.attemptLogin", [password, function(success){
						if (success){
							//logged in
							Lazarus.dialog.sendResponse(true);
						}
						else {
							//incorrect password
							Lazarus.Login.showError('error.wrong.password');
							//but leave the dialog open
              $('#password').select();
						}
					}]);
				}
				else {
					$('#password').val('').focus();
				}
				
				//don't let the form submit
				return false;
			});
			
			//if the user hits cancel close the dialog
			$('#cancel').click(function(){
				Lazarus.dialog.sendResponse(false);
			});
			
			//or if they hit escape
			$(document).keydown(function(evt){
				var KEY_ESCAPE = 27;
				if (evt.keyCode == KEY_ESCAPE){
					Lazarus.dialog.sendResponse(false);
				}
			})
			
			//and focus on the password box to start
			$('#password').focus();
      
      //pressing any key on the password field clear any error message 
      $('#password').bind('input', function(){
        $('#container').removeClass('error');
      });
		});
  },
  
  showError: function(msgId){
    var text = Lazarus.locale.getString(msgId);
    $('#container').addClass('error');
    $('#login-label').text(text);
  }
}
