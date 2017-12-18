//TODO: show loading icon when doing long running actions

//TODO: better messages when setting up sync (needs a status area with "syncing/saving/prefs saved etc...")

Lazarus.Options = {

  //max expiry time limited to 2 weeks while we figure out the Lazarus Pro transition
  MAX_EXPIRE_FORMS_DAYS: 14,
  
  ONE_DAY: 24 * 60 * 60,
  
	init: function(){
	
		Lazarus.getPref('debugMode', function(debugMode){

			Lazarus.logger = new Lazarus.Logger('[lazarus]', debugMode);
			Lazarus.logger.log("initalizing options page");
      
      Lazarus.locale.setStrings({
        'app.platform': Lazarus.platform.id,
        'app.build': Lazarus.build,
        'app.version': Lazarus.version,
        'app.updateChannel': Lazarus.updateChannel
      });
		
			Lazarus.locale.localiseDOM(document);
		
			Lazarus.Preferences.init();
      
      //whenever a preference is saved, show the saved message
      Lazarus.Event.addListener("preferenceSaved", function(){
        $('#options-saved-msg').fadeIn(function(){
          setTimeout(function(){
            $('#options-saved-msg').fadeOut();
          }, 1500);
        })
      });

      
			//Lazarus.Options.initTabs();
			Lazarus.Options.initSecurityTab();
			Lazarus.Options.initDisabledDomains();
			Lazarus.Options.initExpireForms();
			//Lazarus.Options.initSyncTab();
			Lazarus.Options.showSyncMessages();
			Lazarus.Options.showMessages();
			//Lazarus.Options.initCheckForUpdatesCheckbox();
			Lazarus.Options.checkForUpdates();
      
      $('#reset').click(function(){
        if (confirm(Lazarus.locale.getString('options.reset.confirm'))){
          //reset prefs
          Lazarus.msg("options.resettingPrefs", "loading");
          Lazarus.callBackground("Lazarus.resetPrefs", [function(){
            //rebuild database
            Lazarus.msg("options.rebuildingDatabase", "loading");
            Lazarus.callBackground("Lazarus.Background.rebuildDatabase", [function(){
              //and reload this page (so all the changes to the prefs are noted)
              //and show "all setting reset" message
              window.location.hash = "#success:options.preferencesReset";
              window.location.reload();
            }]);
          }]);
        }
      })
			
      //hitting enter when on a textbox with an onenter handler should click that button
      $('*[onenter]').keydown(function(evt){
        var KEY_ENTER = 13;
        if (evt.keyCode == KEY_ENTER){
          var id = $(this).attr('onenter');
          $('#'+ id).click();
        }
      });
      
      $('*[onescape]').keydown(function(evt){
        var KEY_ESCAPE = 27;
        if (evt.keyCode == KEY_ESCAPE){
          var id = $(this).attr('onescape');
          $('#'+ id).click();
        }
      });
      
      
      //developer tab should be hidden by default
      $("h1 a").click(function(evt){
        if (evt.altKey && evt.shiftKey){
          //show the developer panel
          $('#developer-tabpanel').slideToggle();
          return false;
        }
        if (evt.altKey){
          //show the debugging panel
          $('#debugging-tabpanel').slideToggle();
          return false;
        }
        
			});
      
		
			//close button closes the options dialog
			$("#close").live("click", function(){
				window.close();
			});	
			
			$("#database-rebuild").live("click", function(){
          if (confirm("This will delete all Lazarus data for this browser and reset the database to a default state.\nAre you really sure you want to do that?")){
          Lazarus.msg("options.rebuildingDatabase", "loading");
          Lazarus.callBackground("Lazarus.Background.rebuildDatabase", [function(){
            Lazarus.msg("options.databaseRebuilt", "success");
          }]);
        }
			})
			
			$('#unittests-run').live("click", function(){
				Lazarus.callBackground("Lazarus.openURL", [Lazarus.baseURI +"unit-tests.html"]);
			});
      
			//show messages on page load if appropriate
      if (window.location.hash){
        var m = window.location.hash.match(/#(\w+):([\w\.]+)$/);
        if (m){
          Lazarus.msg(m[2], m[1]);
          window.location.hash = '';
        }
      }
      
      
      $('#worker-aes-test').live('click', function(){
        var worker = new Lazarus.Worker2('aes.js', 'js/');
        worker.call('Lazarus.AES.encrypt', ['test string', 'passphrase'], function(encryptedString, error){
          if (error){
            alert(error);
          }
          else {
            alert(encryptedString);
          }
        });
      })
      

      
      $('#link-reenter-sync-info').click(function(){
        //open the sync server settings
        $('#sync-login-box').slideUp();
        $('#sync-create-account-box').slideToggle();
        $('#sync-create-email').focus();
        //and highlight the sync box
        $('#sync-setup-box').addClass('message error');
        //and scroll down to the sync-setup-box
        var y = parseInt($('#sync-setup-box').offset().top);
        window.scrollTo(0, y);
        return false;
      })
      
      
      $('#overlay').fadeOut("fast", function(){
        $(this).hide();
      });
		});
	},
  
  
  // initCheckForUpdatesCheckbox: function(){
    
    // Lazarus.getPref("updateChannel", function(updateChannel){
      // $('#updates-checkforbetaversions')[0].checked = (updateChannel == "beta");
    
      // $('#updates-checkforbetaversions').change(function(){
        // var updateChannel = (this.checked) ? 'beta' : 'stable';
        
        // //save the change.
        // Lazarus.setPref('updateChannel', updateChannel, function(){
          // //and immediately do an update check
          // Lazarus.Options.checkForUpdates();
        // });
      // });
    // });
  // },
  
  
  initDisabledDomains: function(){
    Lazarus.callBackground("Lazarus.Background.getSetting", ["disabledDomains", function(disabledDomains){
      var domains = Lazarus.Utils.mapKeys(disabledDomains);
      domains.sort();
      
      if (domains.length){
        $('#disabled-domains-info').text(Lazarus.locale.getString("options.disabledDomains.info"));
        for(var i=0; i<domains.length; i++){
          //wrap in anonomous function so variables don't change when next item in array is processed
          (function(){
            var domain = domains[i];
            var $li = $('<li class="domain" />').appendTo('#disabled-domains-list');
            var $span = $('<span class="domain-name" />').text(domain).appendTo($li);
            var $btn = $('<button class="btn-delete-domain" />').attr({'domain': domain}).text(Lazarus.locale.getString("options.disabledDomains.delete")).click(function(){
              delete disabledDomains[domain];
              Lazarus.callBackground("Lazarus.Background.setSetting", ["disabledDomains", disabledDomains, function(){
                Lazarus.Event.fire('preferenceSaved', 'disabledDomains', disabledDomains);
                $li.slideUp(function(){
                  $li.remove();
                  if ($('#disabled-domains-list').children('li').length == 0){
                    $('#disabled-domains-info').text(Lazarus.locale.getString("options.disabledDomains.none"));
                  }
                });
              }]);
            }).appendTo($li);
          })();
        }
      }
      else {
        $('#disabled-domains-info').text(Lazarus.locale.getString("options.disabledDomains.none"));
      }
    }, {}]);
  },
  
  
  
  showSyncMessages: function(){
    //fetch messages from the background page
    Lazarus.callBackground("Lazarus.Sync.getSyncMessages", [function(msgs){
      if (msgs){
        for(var i=0; i<msgs.length; i++){
          var msg = msgs[i];
          $('<div class="message" />').addClass(msg.type).html(msg.html).appendTo('#sync-messages');
        }
      }
      else {
        //no messsages, do nothing
      }
    }]);
  },
  
  
  showMessages: function(){
    var args = Lazarus.Utils.decodeQuery(document.location.search);
    if (args.msgid){
      var msg = Lazarus.locale.getString(args.msgid);
      var msgType = args.msgtype ? args.msgtype : 'info';
      $('<div class="message" />').addClass(msgType).html(msg).appendTo('#sync-messages');
    }
  },
  
  
  
  initExpireForms: function(){
  
    $('#expire-forms-interval').bind('input change', function(){
      if ($('#expire-forms-interval').val() > Lazarus.Options.MAX_EXPIRE_FORMS_DAYS){
        Lazarus.msg("options.expireForms.intervalTooLarge", "error", {days: Lazarus.Options.MAX_EXPIRE_FORMS_DAYS});
        //trigger the onchange event to the new values will be saved
				$('#expire-forms-interval').val(Lazarus.Options.MAX_EXPIRE_FORMS_DAYS).trigger('change');
      }
    })
  },
  
  
	initTabs: function(){
		//initalise tabs
		$('.tab-panel:not(:first)').hide();
		
		$(".tabs li a").click(function(e){
			e.preventDefault();
			e.stopPropagation();
			$(".tabs li a").removeClass('active');
			$(this).addClass('active');
			var tabId = this.href.match(/#(.*)$/)[1];
			$(".tab-panel").hide();
      $("#" + tabId).show();
		});
    
    //if the user CTRL clicks the tabbar then show the developer tab (unit tests and such)
    $('.tabs').click(function(evt){
      if (evt.shiftKey || evt.ctrlKey){
        $(".tab-panel").hide();
        $("#developer-tabpanel").show();
      }
    });
	},
  
  
  saveEncryptionType: function(){
    //if we have a password set, then use hybrid encryption,
    Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
      //if the user's password is set, then select the "require password" checkbox
      if (passwordSet){
        Lazarus.setPref("encryptionMethod", "hybrid");
      }
      //otherwise use none
      else {
        Lazarus.setPref("encryptionMethod", "none");
      }
    }]);
  },
  
  
  checkForUpdates: function(){
    //
    var $div = $('#update-check');
    $div.removeClass('loading update success error').addClass("loading").text(Lazarus.locale.getString("options.updates.checking"));
    Lazarus.callBackground("Lazarus.Background.checkForUpdates", [true, function(response){
      $div.removeClass("loading");
      if (response){
        if (Lazarus.Utils.versionCompare(response.version, ">", Lazarus.version)){
          $div.addClass("update").html(Lazarus.locale.getString("options.updates.newVersionAvailable", response));
        }
        else {
          $div.addClass("success").html(Lazarus.locale.getString("options.updates.ok"));
        }
      }
      else {
        $div.addClass("error").text(Lazarus.locale.getString("options.updates.error"));
      }
    }]);
  },
  
  
  initSecurityTab: function(){
  
    //hide some stuff to begin with
    $('#encryption-password-box').hide();
    $('#encryption-password-change, #encryption-password-reset-field, #encryption-password-remove').hide();
    
    Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
      //if the user's password is set, then select the "require password" checkbox
      if (passwordSet){
        $('#encryption-checkbox').attr("checked", "true");
        //and show the change passwords button
        $('#encryption-password-change').show();
      }
    }]);
    
    
    
    //checking the "require password" checkbox should open the set password dialog
    $('#encryption-checkbox').change(function(){
      if (this.checked){
        //open the Set Password dialog
        
        //hide the "enter old password" box because the user has no password set at this point
        $('#encryption-password-old-field').hide();
        $('#encryption-password-reset-field').hide();
        //and show the "save" button
        $('#encryption-password-remove').hide();
        $('#encryption-password-save').show();
      
        $('#encryption-password-field, #encryption-password-confirm-field').show();
        $('#encryption-password-box').slideDown(function(){
          $('#encryption-password').focus();
        });
      }
      else {
        //if they are attempting to remove the existing password 
        //then they'll need to enter it to start with
        //for now, we'll re-check the checkbox, and uncheck it if they are successfull 
        $('#encryption-checkbox').attr('checked', true);
        
        Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
        
          if (passwordSet){
            //show the "enter old password" textbox before the user can remove their password
            $('#encryption-password-remove').show();
            $('#encryption-password-save').hide();
            
            $('#encryption-password-old-field').show();
            $('#encryption-password-reset-field').show();
            $('#encryption-password-field, #encryption-password-confirm-field').hide();
            $('#encryption-password-box').slideDown(function(){
              $('#encryption-password-old').focus();
            });
          }
          else {
            //No password set, so just close the set password block
            $('#encryption-password-box').slideUp();
            $('#encryption-checkbox').attr('checked', false);          
          }
        }]);
      }
    });
    
    
    //change password should open the change password dialog
    $('#encryption-password-change').click(function(){
      
      //open the Set Password dialog, and include the "old password" input as well
      $('#encryption-password-old-field, #encryption-password-field, #encryption-password-confirm-field, #encryption-password-reset-field').show();
      //make sure the save button is visible
      $('#encryption-password-remove').hide();
      $('#encryption-password-save').show();
            
      $('#encryption-password-box').slideDown(function(){
        $('#encryption-password-old').focus();
      });
    });
    
    
    //hitting save should save the new password
    $('#encryption-password-save, #encryption-password-remove').click(function(){
    
      var oldPassword = $('#encryption-password-old').val().trim();
      var newPassword = $('#encryption-password').val().trim();
      var conf = $('#encryption-password-confirm').val().trim();
      
      
      function saveNewPassword(){
      
        if (newPassword != conf){
          $('#encryption-password').focus();
          Lazarus.msg('error.passwords.do.not.match', 'error');
        }
        else {
        
          //all good, set the new password
          Lazarus.callBackground('Lazarus.Background.fetchPrivateKey', [oldPassword, function(privateKey){
            
            if (privateKey){
              Lazarus.callBackground('Lazarus.Background.savePrivateKey', [privateKey, newPassword, function(success){
                //and set the encryptionMethod preference
                var encryptionMethod = newPassword ? "hybrid" : "none";
                Lazarus.callBackground('Lazarus.setPref', ["encryptionMethod", encryptionMethod, function(){
                  Lazarus.Options.saveEncryptionType();
                  if (newPassword){
                    Lazarus.callBackground('Lazarus.Background.logout', [function(){
                      Lazarus.msg('password.set', 'success');
                      $('#encryption-password-change, #encryption-password-reset').show();
                    }])
                  }
                  else {
                    Lazarus.msg('password.removed', 'success');
                    $('#encryption-checkbox').attr('checked', false);   
                    $('#encryption-password-change, #encryption-password-reset').hide();
                  }
                  //and cleanup
                  $('#encryption-password-box').slideUp();
                  $('#encryption-password-old, #encryption-password, #encryption-password-confirm').val('');
                }]);
              }])
            }
            else {
              Lazarus.logger.error("Unable to load private key, incorrect password?");
              Lazarus.msg('error.unable.to.load.encryption.key', 'error');
            }
          }]);
        }
      }
      
      
      
      //are they changing their password, or setting a new one?
      if ($('#encryption-password-old').is(':visible')){
        //then check old password is correct
        Lazarus.callBackground('Lazarus.Background.attemptLogin', [oldPassword, function(success){
          if (success){
            saveNewPassword();
          }
          else {
            Lazarus.msg('error.wrong.password', 'error');
            $('#encryption-password-old').focus();
          }
        }]);
      }
      else {
        saveNewPassword();
      }
    });
    
    
    $('#encryption-password-reset').click(function(){
      if (confirm("This deletes all Lazarus saved form data. Are you absolutely sure?")){
        Lazarus.callBackground('Lazarus.Background.rebuildEncryptionKeys', [function(success){
          $('#encryption-checkbox').attr('checked', false);
          $('#encryption-password-change, #encryption-password-reset-field').hide();
          $('#encryption-password-box').slideUp();
          Lazarus.Options.saveEncryptionType();
          Lazarus.msg('password.reset', 'success');
        }])
      }
    });
    
    
    //clicking the cancel button should close the set password dialog
    $('#encryption-password-cancel').click(function(){
      $('#encryption-password, #encryption-password-confirm, #encryption-password-old').val('');
      $('#encryption-checkbox').attr('checked', false);
      $('#encryption-password-box').slideUp();
      
      //if the user is changing their password and they hit cancel, then DON'T uncheck the checkbox
      Lazarus.callBackground("Lazarus.Background.isPasswordSet", [function(passwordSet){
        $('#encryption-checkbox').attr('checked', passwordSet);
      }]);
    })
  },
  
  
  setSyncInfo: function(){
    Lazarus.getPrefs(['syncEnabled', 'syncEmail'], function(prefs){
      if (prefs.syncEnabled){
        //check to see if sync is properly setup
        Lazarus.callBackground("Lazarus.Sync.checkSyncKey", [function(response){
          if (response.error && response.errorNum == Lazarus.Sync.ERROR_INCORRECT_SYNC_KEY){
            //show the warning
            $('div.sync-login-warning').show();
            //and show the login section
            $('#sync-setup-box').show();
            $('#sync-login-box').show();
          }
          else {
            //all good, fill in the last sync time and account info
            Lazarus.callBackground("Lazarus.Background.getSetting", ['lastSyncTime', function(lastSyncTime){
              prefs.lastSyncedStr = Lazarus.locale.formatElapsedTime(lastSyncTime ? (Lazarus.Utils.timestamp() - lastSyncTime) : -1);
              
              var syncInfo = Lazarus.locale.getString('options.sync.syncInfo', prefs);
              $('#sync-info').html(syncInfo);
              
              //and show syncing box
              $('#sync-enabled-box').show();
            }]);
          }
        }]);
      }
      else {
        $('#sync-setup-box').show();
      }
    });
  },  
  
  
  clearServerData: function(callback){
    Lazarus.callBackground('Lazarus.Sync.callAPI', ['/user/resetDatabase', {}, function(response){
      callback(response);
    }]);
  },
  
  
  login: function(response, password){
  
    Lazarus.logger.log("saving user", response, password);
    
    var syncKey = Lazarus.Sync.generateSyncKey(response.email, password);
    var syncKeyHash = Lazarus.Sync.secureHash(syncKey);
    
    Lazarus.setPref('userId', response.userId, function(){
      Lazarus.setPref('syncKey', syncKey, function(){
        Lazarus.setPref('syncKeyHash', syncKeyHash, function(){
          Lazarus.setPref('syncEnabled', true, function(){
            
            //clear the password boxes
            $('#sync-login-password, #sync-create-password, #sync-create-confirm').val('');
            
            $('#sync-setup-box').slideUp();
            $('#sync-enabled-box').slideDown();
            
            //and then sync this account
            var func = response.newUser ? 'Lazarus.Sync.setupPrimarySync' : 'Lazarus.Sync.setupSecondarySync';
            
            Lazarus.msg('options.sync.syncing', 'loading');
            Lazarus.callBackground(func, [function(response){
              if (response.errorMessages){
                Lazarus.msg(response.errorMessages, "error");
              }
              else {
                Lazarus.msg('options.sync.success', 'success');
                Lazarus.Options.setSyncInfo();
              }
            }]);
          }); 
        }); 
      }); 
    })
  },
  
	close: function(){
		setTimeout(window.close, 1);
	}
}



