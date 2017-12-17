//setup our namespace

Lazarus.FirefoxDialog = {

  args: window.arguments[0],

  init: function(){
    //set the dialogs iframe to the url we have been sent
    //var params = window.arguments[0]; 
    var iframe = document.getElementById('lazarus-dialog-iframe');
    iframe.setAttribute("src", Lazarus.FirefoxDialog.args.url);
    Lazarus.FirefoxDialog.args.returnVal = null;
    //and listen for messages from the iframe
    window.addEventListener("message", Lazarus.FirefoxDialog.handleMessage, false);
  },
  
  handleMessage: function(msg){
    Lazarus.FirefoxDialog.args.returnVal = JSON.parse(msg.data);
    Lazarus.FirefoxDialog.hide();
  },
  
  hide: function(){
    //close the dialog
    window.close();
  }
}

