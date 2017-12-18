//TODO: need to count number of new records during sync


(function () {

  Lazarus.environment = "background";

  Lazarus.Background = {

    initialized: false,

    AUTOSAVE_SAVE_TO_DISK_DELAY: 500,

    //time (in milliseconds) before autosaves should be considered "submitted" and therefore should be saved as "normal" forms
    AUTOSAVE_EXPIRY_TIME: 5 * 60 * 1000,

    state: Lazarus.STATE_UNINITIALIZED,

    autosaves: {},
    lastAutosave: '',
    lastAutosaveTime: 0,
    saveExpiredAutosavesTimer: 0,

    checkForUpdatesTime: 0,

    disabledDomains: {},

    canRemoveExpiredForms: true,

    init: function () {

      window.addEventListener("unload", function (e) {
        Lazarus.adapter.connect(function (db) {
          db.close();
        });
      });

      Lazarus.Event.addListener('stateChange', Lazarus.Background.onStateChange);

      Lazarus.Background.setState(Lazarus.STATE_LOADING);

      Lazarus.Background.runUpdates(function () {
        Lazarus.Background.initDatabase(function () {
          Lazarus.Background.initHashSeed(function () {
            Lazarus.Background.initEncryption(function () {
              Lazarus.Background.loadAutosaves();
              //Lazarus.Sync.init();
              Lazarus.Background.setState(Lazarus.STATE_ENABLED);
              Lazarus.Background.initialized = true;
              Lazarus.addURLListener(Lazarus.Background.urlListener);

              setTimeout(Lazarus.Background.checkForUpdates, 6 * 1000);
              setTimeout(Lazarus.Background.checkExpiredForms, 10 * 1000);
            });
          });
        });
      });
    },


    urlListener: function () {
      Lazarus.fetchCurrentURL(function (newURL) {
        if (newURL && (Lazarus.Background.currentURL != newURL)) {
          Lazarus.Background.currentURL = newURL;
          Lazarus.Background.onURLChange(newURL);
        }
      })
    },


    onURLChange: function (url) {
      Lazarus.logger.log("onURLChange", url);
      Lazarus.Background.refreshUI();
    },


    setState: function (newState) {
      if (Lazarus.Background.state != newState) {
        var oldState = Lazarus.Background.state;
        Lazarus.Background.state = newState;
        Lazarus.Event.fire('stateChange', oldState, newState);
      }
    },


    onStateChange: function (oldState, newState) {
      Lazarus.logger.log("onStateChange", oldState, newState)
      Lazarus.Background.refreshUI();
    },


    onToolbarItemClick: function (evt) {
      //default action is to open the options dialog
      Lazarus.Background.openOptions();
    },


    refreshUI: function () {
      //update the toolbar icon
      var toolbarItem = {
        icon: '',
        tooltip: Lazarus.locale.getString('toolbar.tooltip.default'),
        onclick: Lazarus.Background.onToolbarItemClick,
        disabled: false
      }


      switch (Lazarus.Background.state) {
        case Lazarus.STATE_UNINITIALIZED:
          toolbarItem.icon = Lazarus.toolbarIcons.disabled;
          toolbarItem.disabled = true;
          break;

        case Lazarus.STATE_LOADING:
          toolbarItem.icon = Lazarus.toolbarIcons.enabling;
          toolbarItem.tooltip = Lazarus.locale.getString('toolbar.tooltip.loading');
          toolbarItem.disabled = true;
          break;

        case Lazarus.STATE_ENABLED:

          //ALWAYS disable Lazarus in private browsing mode
          if (Lazarus.platform.isPrivateBrowsingEnabled()) {
            toolbarItem.icon = Lazarus.toolbarIcons.disabled;
            toolbarItem.tooltip = Lazarus.locale.getString('toolbar.tooltip.disabled.privateBrowsing');
          }
          else {
            Lazarus.getPref('syncEnabled', function (syncEnabled) {
              //if we have sync messages then show them
              if (syncEnabled && Lazarus.Sync.syncMessages && Lazarus.Sync.syncMessages.length) {
                toolbarItem.icon = Lazarus.toolbarIcons.syncMessages;
                toolbarItem.tooltip = Lazarus.locale.getString('toolbar.tooltip.syncMessages');
                Lazarus.updateToolbarButton(toolbarItem);
              }
              //if we have sync problems then show them
              else if (syncEnabled && Lazarus.Sync.syncErrors && Lazarus.Sync.syncErrors.length) {
                toolbarItem.icon = Lazarus.toolbarIcons.syncError;
                toolbarItem.tooltip = "Sync Error\n" + Lazarus.Sync.syncErrors.join("\n");
                Lazarus.updateToolbarButton(toolbarItem);
              }
              else if (Lazarus.Background.currentURL) {
                Lazarus.Background.isURLEnabled(Lazarus.Background.currentURL, function (enabled, reason) {
                  if (enabled) {
                    toolbarItem.icon = Lazarus.toolbarIcons.enabled;
                    toolbarItem.tooltip = Lazarus.locale.getString('toolbar.tooltip.default');
                  }
                  //no point in showing the icon as disabled on chrome:// and about:// urls
                  else if (Lazarus.Background.currentURL.match(/^(chrome|about|chrome\-extension):/i)) {
                    toolbarItem.icon = Lazarus.toolbarIcons.enabled;
                    toolbarItem.tooltip = Lazarus.locale.getString('toolbar.tooltip.default');
                  }
                  else {
                    var domain = Lazarus.Utils.extractDomain(Lazarus.Background.currentURL);
                    toolbarItem.icon = Lazarus.toolbarIcons.disabledForURL;
                    toolbarItem.tooltip = Lazarus.locale.getString('toolbar.tooltip.disabled.' + reason, { domain: domain });
                  }
                  Lazarus.updateToolbarButton(toolbarItem);
                });
              }
              else {
                toolbarItem.icon = Lazarus.toolbarIcons.enabled;
                toolbarItem.tooltip = Lazarus.locale.getString('toolbar.tooltip.default');
                Lazarus.updateToolbarButton(toolbarItem);
              }
            });
          }
          break;

        default:
          throw Error("Unknown state '" + Lazarus.Background.state + "'");
          break;
      }

      Lazarus.updateToolbarButton(toolbarItem);
    },


    checkExpiredForms: function () {
      Lazarus.Background.removeExpiredForms(function () {
        //check again in a while
        setTimeout(Lazarus.Background.checkExpiredForms, 30 * 60 * 1000);
      });
    },


    removeExpiredForms: function (callback) {
      callback = (typeof callback == "function") ? callback : function () { };

      //remove all old forms from the database.
      //NOTE: if the user is currently looking at a list of items to recover, then we shouldn't remove any forms even if they have expired
      if (Lazarus.Background.canRemoveExpiredForms) {
        Lazarus.logger.log("Remove Expired Forms...");
        Lazarus.getPref("expireFormsInterval", function (expireFormsInterval) {
          var ONE_DAY = 24 * 60 * 60;
          var expiryTime = Lazarus.Utils.timestamp() - (expireFormsInterval * ONE_DAY);

          Lazarus.adapter.connect(function (db) {
            var schema = db.getSchema();

            var tForms = schema.table('forms');
            var tFormFields = schema.table('form_fields');
            var tFields = schema.table('fields');

            var tx = db.createTransaction();

            tx.begin([tForms, tFormFields, tFields]).then(function () {
              var q1 = db.delete().from(tForms)
                .where(tForms.lastModified.lt(expiryTime));

              return tx.attach(q1);
            }).then(function (results) {
              var q2 = db.delete().from(tFormFields)
                .where(tFormFields.lastModified.lt(expiryTime));

              return tx.attach(q2);
            }).then(function (results) {
              var q3 = db.delete().from(tFields)
                .where(tFields.lastModified.lt(expiryTime));

              return tx.attach(q3);
            }).then(function () {
              return tx.commit();
            }).then(function () {
              callback();
            }).catch(function (err) {
              throw err;
            });
          });
        });
      }
      else {
        setTimeout(function () {
          Lazarus.logger.log("waiting to remove expired forms");
          Lazarus.Background.removeExpiredForms(callback);
        }, 5 * 1000);
      }
    },





    autosaveForm: function (formInfo, callback) {
      //autosaves are different from saving submitted forms.
      //submitted forms are kept for a long time, but autosaves should 
      //only be kept until after the next restart.
      //autosaves also happen a lot more often than submitted forms, 
      //so we won't be using anything that might block the UI when saving them 
      //(ie not database access, no encryption). I think the no encryption for autosaved forms
      //thing *might* be ok considering the forms will only be kept until the next restart of the browser
      //However if you're like me and leave the browser running 24/7 what then?
      //perhaps a time limit is a better plan? Yes, autosaves are for "emergency" recovery, 
      //I think having a default expiry time of 15 minutes should be plenty for most people.
      //after that the user shouldn't care if the unfinished form is lost?
      //but what about if they've walked away from the machine, it's gone into sleep, and the form is lost (eg machine has hung)?
      //Hmmm, needs pondering...
      //better to assume any form left (not updated) for more then a couple of minutes should be assumed to have been submitted,
      //yes this is perhaps a better strategy
      //we need to save the form as simply as possible, but we'll also need to be able to recover it using the form recovery code
      formInfo.lastModified = Lazarus.Utils.timestamp();

      //immediately save to memory store
      Lazarus.Background.autosaves[formInfo.formInstanceId] = formInfo;

      if (Lazarus.Background.lastAutosaveTime + Lazarus.Background.AUTOSAVE_SAVE_TO_DISK_DELAY < Lazarus.Utils.microtime()) {
        //we're safe to save
        Lazarus.Background.saveAutosaves(function () {
          callback(true);
        });
      }
      //save after the autosave delay
      else if (!Lazarus.Background.autosaveTimer) {
        Lazarus.Background.autosaveTimer = setTimeout(Lazarus.Background.saveAutosaves, Lazarus.Background.AUTOSAVE_SAVE_TO_DISK_DELAY);
        callback(false);
      }
      //the autosave timer has already been set,
      //form will be saved when it fires
      else {
        //do nothing
        callback(false);
      }
    },


    //convert expired autosaves to "real" saved forms
    saveExpiredAutosaves: function () {

      //callback = callback || function(){};

      clearTimeout(Lazarus.Background.saveExpiredAutosavesTimer);

      //separate out the autosaved data from that which should be added to the database 
      var expiredAutosaves = [];

      //lastModified time is in seconds
      var expiryTime = Lazarus.Utils.timestamp() - (Lazarus.Background.AUTOSAVE_EXPIRY_TIME / 1000);
      var nonExpiredAutosaveCount = 0;
      for (var id in Lazarus.Background.autosaves) {
        var autosave = Lazarus.Background.autosaves[id];
        if (autosave.lastModified < expiryTime) {
          //console.log("mark autosave as submitted", autosave.lastModified, expiryTime, autosave.lastModified < expiryTime, autosave);
          expiredAutosaves.push([autosave]);
          //and remove it from the autosave list
          delete Lazarus.Background.autosaves[id];
        }
        else {
          nonExpiredAutosaveCount++;
        }
      }

      //console.log('converting '+ expiredAutosaves.length +' autosaves to submitted forms');
      Lazarus.Utils.callAsyncs(Lazarus.Background.saveForm, expiredAutosaves, function () {

        //if there are stioll autosaves in the queue, then set timer to check again
        if (nonExpiredAutosaveCount > 0) {
          //console.log("restarting saveExpiredAutosavesTimer");
          Lazarus.Background.saveExpiredAutosavesTimer = setTimeout(function () {
            Lazarus.Background.saveExpiredAutosaves();
          }, Lazarus.Background.AUTOSAVE_EXPIRY_TIME);
        }

        //callback();
      });
    },



    saveAutosaves: function (callback, force) {
      callback = (typeof callback == "function") ? callback : function () { };

      //clear the autosave timer (if it exists)
      clearTimeout(Lazarus.Background.autosaveTimer);
      Lazarus.Background.autosaveTimer = 0;

      //we're going to encrypt the autosaves with the users hash seed.
      //this is obviously insecure (the hash seed is in plain text inside the database)
      //but the autosaves are only kept for the one session,
      //this also means that if the user resets the database then the autosaved text becomes very difficult to recover
      //if the user has chosen to not encrypt their data (CPU issue?) then we should leave it in plain json?
      var json = JSON.stringify(Lazarus.Background.autosaves);

      if (json != '{}' && !Lazarus.Background.saveExpiredAutosavesTimer) {
        //there are still autosaves to save as submitted forms
        Lazarus.Background.saveExpiredAutosavesTimer = setTimeout(Lazarus.Background.saveExpiredAutosaves, Lazarus.Background.AUTOSAVE_EXPIRY_TIME);
      }

      //console.log('saving autosaves to disk', json);
      if (json != Lazarus.Background.lastAutosave || force === true) {
        Lazarus.logger.log("Autosaving forms", Lazarus.Background.autosaves);
        Lazarus.Background.lastAutosave = json;

        Lazarus.getPref("encryptionMethod", function (encryptionMethod) {
          var data = (encryptionMethod == "none") ? json : Lazarus.AES.encrypt(json, Lazarus.Background.hashSeed);
          Lazarus.setPref("autosaves", data, function () {
            Lazarus.Background.lastAutosaveTime = Lazarus.Utils.microtime();
            callback(true);
          });
        });
      }
      else {
        callback(true);
      }
    },


    //remove all forms from autosaves that match the given function
    removeAutosaves: function (matchFn, callback) {
      callback = callback || function () { }
      for (var formInstanceId in Lazarus.Background.autosaves) {
        var form = Lazarus.Background.autosaves[formInstanceId];
        if (matchFn(form)) {
          delete Lazarus.Background.autosaves[formInstanceId]
        }
      }
      Lazarus.Background.saveAutosaves(function () {
        callback();
      })
    },


    removeAllAutosaves: function (callback) {
      Lazarus.Background.autosaves = {};
      Lazarus.setPref("autosaves", '', function () {
        Lazarus.Background.lastAutosaveTime = 0;
        callback(true);
      });
    },


    saveForm: function (formInfo, callback) {
      //time to save the form
      callback = callback || function () { };

      Lazarus.logger.log("saving form...");

      Lazarus.getPref("encryptionMethod", function (encryptionMethod) {
        Lazarus.getPref("savePasswords", function (savePasswords) {

          formInfo.encryptionMethod = encryptionMethod;
          formInfo.encyptedURL = Lazarus.Background.encrypt(formInfo.url, encryptionMethod);
          formInfo.encryptedDomain = Lazarus.Background.encrypt(formInfo.domain, encryptionMethod);
          formInfo.lastModified = Lazarus.Utils.timestamp();

          //generate an id for this form
          formInfo.domainId = Lazarus.Background.hash(formInfo.domain);
          formInfo.formId = Lazarus.Background.generateFormId(formInfo);

          //save domain info. We can do this syncronusly, as it doens't actually matter if this info is saved or not
          //(only used for search, and that's not currently implemented)
          Lazarus.adapter.connect(function (db) {
            var schema = db.getSchema();

            var tDomains = schema.table('domains');

            db.select().from(tDomains).where(tDomains.id.eq(formInfo.domainId)).exec()
              .then(function (results) {
                var existingDomain = results[0];
                formInfo.totalEditingTime = (existingDomain && existingDomain.editingTime) ? (formInfo.editingTime + existingDomain.editingTime) : formInfo.editingTime;
                var row = tDomains.createRow({ id: formInfo.domainId, domain: formInfo.encryptedDomain, editingTime: formInfo.totalEditingTime, lastModified: formInfo.lastModified, status: 0 });
                return db.insertOrReplace().into(tDomains).values([row]).exec().then(
                  function (rows) {
                    Lazarus.logger.log('domain updated', formInfo.domain, formInfo.domainId, formInfo.totalEditingTime);
                  });
              })
              .then(function () {
                var tForms = schema.table('forms');
                return db.select().from(tForms).where(tForms.id.eq(formInfo.formId)).exec()
                  .then(function (results) {
                    var existingForm = results[0];
                    formInfo.totalFormEditingTime = (existingForm && existingForm.editingTime) ? (formInfo.editingTime + existingForm.editingTime) : formInfo.editingTime;
                    var row = tForms.createRow({ id: formInfo.formId, domainId: formInfo.domainId, encryption: formInfo.encryptionMethod, url: formInfo.encyptedURL, editingTime: formInfo.totalFormEditingTime, lastModified: formInfo.lastModified, status: 0 });
                    return db.insertOrReplace().into(tForms).values([row]).exec().then(
                      function (rows) {
                        //build the list of fields we're going to save
                        var fields = [];
                        for (var i = 0; i < formInfo.fields.length; i++) {
                          var field = formInfo.fields[i];

                          if (!savePasswords && field.type === "password") {
                            field.value = null;
                          }

                          //don't save fields if their value has been set to null (eg password fields)
                          if (field.value !== null) {
                            field.id = field.fieldId = Lazarus.Background.generateFieldId(field);
                            field.formId = formInfo.formId;
                            field.formFieldId = Lazarus.Background.hash(field.id + "-" + field.formId);
                            field.domainId = formInfo.domainId;
                            field.encryptionMethod = field.encryption = encryptionMethod;
                            if (field.encryptionMethod == "none" && typeof field.value != "string") {
                              field.encryptionMethod = "json";
                            }
                            field.encryptedValue = field.value = Lazarus.Background.encrypt(field.value, field.encryptionMethod);
                            field.lastModified = formInfo.lastModified;
                            field.status = 0;
                            fields.push(field);
                          }
                        }

                        //insert the values for the fields 
                        if (fields.length) {
                          var tFields = schema.table('fields');
                          var tFormFields = schema.table('form_fields');

                          var tx = db.createTransaction();

                          tx.begin([tFields, tFormFields]).then(function () {
                            var rows = [];
                            for (var i = 0; i < fields.length; i++) 
                              rows.push(tFields.createRow(fields[i]));
                            var q1 = db.insertOrReplace().into(tFields).values(rows);

                            return tx.attach(q1);
                          }).then(function (results) {
                            var rows = [];
                            for (var i = 0; i < fields.length; i++) 
                              rows.push(tFormFields.createRow(fields[i]));
                            var q2 = db.insertOrReplace().into(tFormFields).values(rows);

                            return tx.attach(q2);
                          }).then(function () {
                            return tx.commit();
                          }).then(function () {
                            Lazarus.logger.log("fields saved", arguments);
                            callback(true);
                          }).catch(function (err) {
                            throw err;
                          });
                        }
                        else {
                          Lazarus.logger.log("nothing to save");
                          callback(false);
                        }
                      }).catch(function(err) {
                        throw err;
                      });
                  });
              });
          });
        });
      });
    },


    hash: function (str, seed, returnAsHex) {
      return Lazarus.FNV1a(str, seed, !returnAsHex);
    },

    /**
    * generate a hash for this field
    **/
    generateFieldId: function (field) {
      return Lazarus.Background.hash(field.domain + "," + field.name + "," + field.type + "," + JSON.stringify(field.value));
    },

    /**
    * generate a hash for this form
    **/
    generateFormId: function (formInfo) {
      //form id is unique for a form on a given URL with the same fields with the same values
      var str = formInfo.url;
      for (var i = 0; i < formInfo.fields.length; i++) {
        var field = formInfo.fields[i];
        str += "," + field.name + "," + field.type + "," + JSON.stringify(field.value);
      }
      return Lazarus.Background.hash(str);
    },

    generateRandomHashSeed: function () {
      var rnd = Math.random().toString() + ':' + Lazarus.Utils.timestamp(true).toString();
      return Lazarus.FNV1a(rnd);
    },


    fetchSavedText: function (domain, callback) {
      var args = {
        domainId: Lazarus.Background.hash(domain)
      }
      Lazarus.adapter.connect(function (db) {
        var schema = db.getSchema();

        var tForms = schema.table('forms');
        var tFormFields = schema.table('form_fields');
        var tFields = schema.table('fields');

        db.select().from(tFields)
          .innerJoin(tFormFields, tFormFields.fieldId.eq(tFields.id))
          .innerJoin(tForms, tForms.id.eq(tFormFields.formId))
          .where(lf.op.and(tFields.type.in(['textarea', 'contenteditable', 'iframe']), tFields.domainId.eq(args.domainId), tFields.value.neq(''), tForms.status.eq(0)))
          .orderBy(tForms.lastModified, lf.Order.DESC)
          .limit(10)
          .exec()
          .then(function (results) {
            //Lazarus.adapter.exe("SELECT fields.encryption, fields.value, forms.lastModified FROM fields INNER JOIN form_fields ON fields.id = form_fields.fieldId INNER JOIN forms ON forms.id = form_fields.formId WHERE type IN ('textarea', 'contenteditable', 'iframe') AND fields.domainId = {domainId} AND value != '' AND forms.status = 0 ORDER BY forms.lastModified DESC LIMIT 10", args, function (rs) {

            //we'll use a map here instead of an array so we can avoid duplicate values
            var found = {};

            for (var i = 0; i < results.length; i++) {
              var field = results[i];
              //console.log("fetchSavedText", field);
              field.text = Lazarus.Background.decrypt(field.value, field.encryption);
              //ignore empty text, and only show distinct values
              if (field.text) {
                found[field.text] = field;
              }
              else {
                Lazarus.logger.warn("Unable to decrypt text", field.value, field.encryption);
              }
            }

            //add any text from the autosaved data
            Lazarus.Background.fetchAutosavedText(domain, function (autosaves) {
              for (var i = 0; i < autosaves.length; i++) {
                if (autosaves[i].text) {
                  found[autosaves[i].text] = autosaves[i];
                }
              }

              //convert the map into an array
              found = Lazarus.Utils.mapToArray(found);

              found.sort(Lazarus.Background.orderByLastModified);

              callback(found);
            });
          }).catch(function(err) {
            throw err;
          });
      });
    },



    fetchAutosavedText: function (domain, callback) {
      //stale autosaves are fetched at browser startup?
      //grab the autosaves for this session, and the previous session that match the fieldInfo provided.
      var found = [];

      //console.log("adding autosaved forms");
      for (var id in Lazarus.Background.autosaves) {
        var formInfo = Lazarus.Background.autosaves[id];
        if (formInfo.domain == domain) {
          for (var i = 0; i < formInfo.fields.length; i++) {
            var field = formInfo.fields[i];
            if (Lazarus.Utils.isLargeTextFieldType(field.type) && field.value != '') {
              found.push({
                text: field.value,
                lastModified: formInfo.lastModified
              });
            }
          }
        }
      }

      //console.log("autosaved texts found", found);
      callback(found);
    },


    orderByLastModified: function (a, b) {
      return (a.lastModified > b.lastModified) ? -1 : 1;
    },


    fetchSavedFields: function (fieldInfo, callback) {
      //console.log(fieldInfo);
      fieldInfo.domainId = Lazarus.Background.hash(fieldInfo.domain);
      Lazarus.adapter.connect(function (db) {
        var schema = db.getSchema();

        var tForms = schema.table('forms');
        var tFormFields = schema.table('form_fields');
        var tFields = schema.table('fields');

        db.select(tFields.encryption, tFields.value, tFormFields.formId, tForms.lastModified).from(tFields)
          .innerJoin(tFormFields, tFormFields.fieldId.eq(tFields.id))
          .innerJoin(tForms, tForms.id.eq(tFormFields.formId))
          .where(lf.op.and(tFields.name.eq(fieldInfo.name), tFields.type.eq(fieldInfo.type), tFields.domainId.eq(fieldInfo.domainId), tFields.value.neq(''), tForms.status.eq(0)))
          .orderBy(tForms.lastModified, lf.Order.DESC)
          .limit(10)
          .exec()
          .then(function (results) {
            //Lazarus.adapter.exe("SELECT fields.encryption, fields.value, form_fields.formId, forms.lastModified FROM fields INNER JOIN form_fields ON fields.id = form_fields.fieldId INNER JOIN forms ON forms.id = form_fields.formId WHERE name = {name} AND type = {type} AND fields.domainId = {domainId} AND value != '' AND forms.status = 0 ORDER BY forms.lastModified DESC LIMIT 10", fieldInfo, function (rs) {
            //we'll keep a map instead of an array to avoid duplicate forms
            var found = {};

            //we'll need to decrypt the values
            for (var i = 0; i < results.length; i++) {
              var field = results[i];
              field.text = Lazarus.Background.decrypt(field.value, field.encryption);
              if (field.text) {
                found[field.formId] = field;
              }
              else {
                Lazarus.logger.warn("Unable to decrypt text", field.value);
              }
            }

            //add any fields/forms from the autosaved data
            Lazarus.Background.fetchAutosavedFields(fieldInfo, function (autosaves) {
              for (var i = 0; i < autosaves.length; i++) {
                found[autosaves[i].formId] = autosaves[i];
              }

              //convert to an array
              found = Lazarus.Utils.mapToArray(found);

              //and sort nicely
              found.sort(Lazarus.Background.orderByLastModified);

              callback(found);
            });
          }).catch(function(err) {
            throw err;
          });
      });
    },


    fetchAutosavedFields: function (fieldInfo, callback) {
      //stale autosaves are fetched at browser startup?
      //grab the autosaves for this session, and the previous session that match the fieldInfo provided.
      var found = [];

      //console.log("adding autosaved forms");
      for (var id in Lazarus.Background.autosaves) {
        var formInfo = Lazarus.Background.autosaves[id];
        var field = Lazarus.Background.findValidField(formInfo, fieldInfo);
        if (field) {
          //console.log("found", formInfo);
          field.formInfo = formInfo;
          field.formId = Lazarus.Background.generateFormId(formInfo);
          field.lastModified = formInfo.lastModified;

          //mark this as an autosaved form
          found.push(field);
        }
      }

      //console.log("autosaved fields found", found);
      callback(found);
    },


    findValidField: function (formInfo, fieldInfo) {
      //form is valid if it's from the same domain, and it contains a field with the same name and type as the field info
      //SQL: WHERE name = {name} AND type = {type} AND domainId = {domainId}  AND value != ''
      //console.log("isValidForm", formInfo, fieldInfo);

      if (formInfo.domain == fieldInfo.domain) {
        //find the field with this name
        for (var i = 0; i < formInfo.fields.length; i++) {
          var field = formInfo.fields[i];
          //console.log(formInfo, fieldInfo, field.name, field.name == fieldInfo.name , field.type == fieldInfo.type , field.value != '')
          if (field.name == fieldInfo.name && field.type == fieldInfo.type && field.value != '') {
            return {
              text: field.value,
              formId: 'autosave:' + formInfo.formInstanceId
            }
          }
        }
      }
      return false;
    },


    fetchForm: function (formId, callback) {

      if (typeof formId == "string" && formId.indexOf('autosave:') === 0) {
        formId = formId.replace('autosave:', '');
        //look for the autosave
        //hmmm, there a chance here that the autosaved form will have been saved to the permenent store.
        if (Lazarus.Background.autosaves[formId]) {
          var formInfo = Lazarus.Background.autosaves[formId];
          callback(formInfo);
        }
        else {
          //check for the form in the database
          Lazarus.Background.fetchForm(formId, callback);
        }
      }
      else {
        //fetch the info about the form
        //Lazarus.adapter.getObj("SELECT id, url, encryption, editingTime FROM forms WHERE id = {formId}", { formId: formId }, function (info) {
        Lazarus.adapter.connect(function (db) {
          var schema = db.getSchema();
          var tForms = schema.table('forms');
          db.select().from(tForms).where(tForms.id.eq(formId)).exec()
            .then(function (results) {
              var info = results[0];
              //and attach all the fields for this formId
              if (info) {
                info.url = Lazarus.Background.decrypt(info.url, info.encryption);
                var tFields = schema.table('fields');
                var tFormFields = schema.table('form_fields');
                return db.select().from(tForms)
                  .innerJoin(tFormFields, tFormFields.fieldId.eq(tFields.id))
                  .where(tForms.id.eq(formId)).exec().then(function (results) {
                    //Lazarus.adapter.exe("SELECT fields.id, name, type, value, domainId, encryption FROM fields INNER JOIN form_fields ON fields.id = fieldId WHERE formId = {formId}", { formId: formId }, function (rs) {
                    info.fields = results[0];
                    for (var i = 0; i < info.fields.length; i++) {
                      info.fields[i].value = Lazarus.Background.decrypt(info.fields[i].value, info.fields[i].encryption);
                    }
                    callback(info);
                  });
              }
              else {
                //no form found
                callback(null);
              }
            });
        });
      }
    },

    setSetting: function (name, value, callback) {
      var data = {
        name: name,
        value: JSON.stringify(value),
        lastModified: Lazarus.Utils.timestamp(),
        status: 0
      }
      Lazarus.adapter.connect(function (db) {
        var schema = db.getSchema();
        var tSettings = schema.table('settings');
        var row = tSettings.createRow(data);
        db.insertOrReplace().into(tSettings).values([row]).exec().then(function () {
          //Lazarus.adapter.exe("REPLACE INTO settings (name, value, lastModified) VALUES ({name}, {value}, {lastModified})", data, function (result) {
          if (callback) {
            //callback(result);
            callback();
          }
        });
      });
    },


    getSetting: function (name, callback, defaultVal) {
      defaultVal = (typeof defaultVal == "undefined") ? null : defaultVal;
      Lazarus.adapter.connect(function (db) {
        var schema = db.getSchema();
        var tSettings = schema.table('settings');
        db.select().from(tSettings).where(tSettings.name.eq(name)).exec()
          .then(function (results) {
            //Lazarus.adapter.getStr("SELECT value FROM settings WHERE name = {name}", { name: name }, function (json) {
            var value = (results[0] && results[0].value) ? JSON.parse(results[0].value) : defaultVal;
            if (value === null) {
              value = defaultVal
            }
            callback(value);
          });
      });
    },

    getSettings: function (names, callback) {
      for (var i = 0; i < names; i++) {
        names[i] = [names[i]];
      }
      Lazarus.Utils.callAsyncs(Lazarus.Background.getSetting, names, function (results) {
        var settings = {};
        for (var i = 0; i < results.length; i++) {
          settings[name[i]] = results[i];
        }
        callback(settings);
      })
    },

    initDatabase: function (callback) {
      Lazarus.adapter.initDatabase(callback);
    },


    initHashSeed: function (callback) {
      callback = callback || function () { };
      Lazarus.logger.log("initalizing hash seed");
      //we need a random hash seed for this user
      Lazarus.Background.getSetting("hashSeed", function (hashSeed) {
        if (!hashSeed) {
          Lazarus.Background.hashSeed = Lazarus.Background.generateRandomHashSeed();
          Lazarus.logger.log("saving new hash seed " + hashSeed);
          Lazarus.Background.setSetting("hashSeed", Lazarus.Background.hashSeed, callback);
        }
        else {
          Lazarus.Background.hashSeed = hashSeed;
          callback();
        }
      });
    },


    initEncryption: function (callback) {
      //generate an RSA public/private key pair in case the user wants more serious security
      callback = callback || function () { };
      Lazarus.logger.log("initalizing rsa key pair");

      Lazarus.Background.getSetting("publicKey", function (packedPublicKey) {
        var publicKey = Lazarus.Crypto.unpack(packedPublicKey);

        Lazarus.Background.getSetting("privateKey", function (encryptedPackedPrivateKey) {
          //by default the privateKey is encrypted with a blank password
          //when a user wants to enable encryption we'll AES encrypt the privateKey using the users passphrase
          var packedPrivateKey = Lazarus.AES.decrypt(encryptedPackedPrivateKey, "");
          var privateKey = packedPrivateKey ? Lazarus.Crypto.unpack(packedPrivateKey) : null;

          if (!publicKey) {
            Lazarus.logger.log("generating new key pair...");
            var newKeys = Lazarus.Crypto.generateKeyPair();
            Lazarus.logger.log("saving new key pair ", newKeys);
            Lazarus.Background.publicKey = newKeys.publicKey;
            Lazarus.Background.privateKey = newKeys.privateKey;

            var newEncryptedPackedPrivateKey = Lazarus.AES.encrypt(Lazarus.Crypto.pack(newKeys.privateKey), "");

            Lazarus.Background.setSetting("publicKey", Lazarus.Crypto.pack(newKeys.publicKey), function () {
              Lazarus.Background.setSetting("privateKey", newEncryptedPackedPrivateKey, function () {
                callback();
              });
            });
          }
          else {
            Lazarus.Background.publicKey = publicKey;
            Lazarus.Background.privateKey = privateKey;
            Lazarus.logger.log("publicKey", publicKey, "privateKey", privateKey);
            callback();
          }
        });
      });
    },



    rebuildDatabase: function (callback) {
      //empty the database
          
      Lazarus.adapter.connect(function (db) {
        var schema = db.getSchema();

        var tForms = schema.table('forms');
        var tFormFields = schema.table('form_fields');
        var tFields = schema.table('fields');
        var tSettings = schema.table('settings');
        var tDomains = schema.table('domains');

        var tx = db.createTransaction();

        tx.begin([tForms, tFields, tFormFields, tSettings, tDomains]).then(function () {
          var q1 = db.dropTable(tForms);
          return tx.attach(q1);
        }).then(function (results) {
          var q2 = db.dropTable(tFields);
          return tx.attach(q2);
        }).then(function (results) {
          var q3 = db.dropTable(tFormFields);
          return tx.attach(q3);
        }).then(function (results) {
          var q4 = db.dropTable(tSettings);
          return tx.attach(q4);
        }).then(function (results) {
          var q5 = db.dropTable(tDomains);
          return tx.attach(q5);
        }).then(function () {
          return tx.commit();
        }).then(function () {
          Lazarus.Background.initDatabase(function () {
            Lazarus.Background.initHashSeed(function () {
              Lazarus.Background.initEncryption(function () {
                //remove all autosaved forms as well
                Lazarus.Background.removeAllAutosaves(function () {
                  callback();
                });
              });
            });
          });
        }).catch(function (err) {
          throw err;
        });
      });

      //then rebuild the database
    },

    rebuildEncryptionKeys: function (callback) {
      //rebuilding the keys also means removing all saved forms, so...
      //Lazarus.adapter.transaction("DROP TABLE {name}", [{ name: "forms" }, { name: "fields" }, { name: "form_fields" }], function (rs) {
      Lazarus.adapter.connect(function (db) {
        var schema = db.getSchema();

        var tForms = schema.table('forms');
        var tFormFields = schema.table('form_fields');
        var tFields = schema.table('fields');

        var tx = db.createTransaction();

        tx.begin([tForms, tFields, tFormFields]).then(function () {
          var q1 = db.dropTable(tForms);
          return tx.attach(q1);
        }).then(function (results) {
          var q2 = db.dropTable(tFields);
          return tx.attach(q2);
        }).then(function (results) {
          var q3 = db.dropTable(tFormFields);
          return tx.attach(q3);
        }).then(function () {
          return tx.commit();
        }).then(function () {
          Lazarus.Background.setSetting("hashSeed", "", function () {
            Lazarus.Background.setSetting("privateKey", "", function () {
              Lazarus.Background.setSetting("publicKey", "", function () {
                //then rebuild the database
                Lazarus.Background.initDatabase(function () {
                  Lazarus.Background.initHashSeed(function () {
                    Lazarus.Background.initEncryption(callback);
                  });
                });
              });
            });
          });
        });
      });
    },


    openOptions: function (options) {
      var url = Lazarus.baseURI + "options.html";
      if (options) {
        url = Lazarus.Utils.urlAdd(url, options);
      }
      Lazarus.openURL(url);
    },


    /**
    * encrypt a string or object using the user chosen encryption method
    **/
    encrypt: function (str, method) {

      //special case Empty String 
      //we'll need to be able to identify empty strings inside the database (so we can ignore them when getting a list of field values to show)
      //so we're going to make an exception, and just save as they are instead of running them through the encryption process
      if (str === "") {
        return "";
      }

      switch (method) {
        case "none":
          return str;

        //whilst not really an encryption method, we're still using it for storage
        case "json":
          return JSON.stringify(str);

        case "hybrid":
          if (Lazarus.Background.publicKey) {
            return Lazarus.Crypto.encrypt(str, Lazarus.Background.publicKey);
          }
          else {
            throw Error("encrypt: public key not loaded");
          }

        default:
          throw Error("encrypt: unknown encryption method '" + method + "'");
      }
    },

    decrypt: function (str, encryption) {

      //special case Empty string (not encrypted, what's the point?)
      //we'll need to be able to identify empty strings inside the database even when they're encrypted (so we can ignore them when getting a list of field values to show)
      //so we're going to make an exception, and just save them as they are instead of running them through the encryption process
      if (str === "") {
        return "";
      }

      //if encryption is not specified (or null), then we'll use legacy encryption.
      //which means the str is a JSON encoded object containing encryption method ("none" or "hybrid") and a json encoded value properties 
      if (!encryption) {
        var obj = Lazarus.Utils.jsonDecode(str);
        if (obj && obj.method) {
          str = obj.value;
          encryption = (obj.method == "none") ? "json" : obj.method;
        }
        else {
          return '';
        }
      }

      switch (encryption) {
        case "none":
          return str;

        case "json":
          return JSON.parse(str);

        case "hybrid":
          if (Lazarus.Background.privateKey) {
            return Lazarus.Crypto.decrypt(str, Lazarus.Background.privateKey);
          }
          else {
            throw Error("decrypt: private key not loaded");
          }

        default:
          throw Error("decrypt: unknown encryption method '" + encryption + "'");
      }
    },


    //return true if the user requires a password before they can restore text (ie: encryption is enabled, and password has not been entered yet)
    isPasswordRequired: function (callback) {
      //private key may or may not be encrypted, but either way the user can decrypt a string
      if (Lazarus.Background.privateKey) {
        callback(false);
      }
      //try to load the private key
      else {
        //XXX FIXME: can't we just detect the privateKey? callback(!Lazarus.Background.privateKey)?
        Lazarus.Background.initEncryption(function () {
          //if after re-initalizing the keys we still don't have a privateKey,
          //then the private key must be encrypted
          Lazarus.Background.privateKey ? callback(false) : callback(true);
        })
      }
    },


    isPasswordSet: function (callback) {

      //we test this by attempting to decrypt the private key string with a blank password
      Lazarus.Background.getSetting('privateKey', function (packedEncryptedPrivateKey) {
        if (packedEncryptedPrivateKey) {
          var packedPrivateKey = Lazarus.AES.decrypt(packedEncryptedPrivateKey, "");
          var privateKey = Lazarus.Crypto.unpack(packedPrivateKey);
          callback(privateKey ? false : true);
        }
        //no key set
        else {
          throw Error("isPasswordSet: No private-key found in database!");
        }
      });
    },

    //return true if a user has set a password, and they have logged in
    isLoggedIn: function (callback) {
      Lazarus.Background.isPasswordSet(function (passwordSet) {
        if (passwordSet) {
          Lazarus.Background.isPasswordRequired(function (passwordRequired) {
            passwordRequired ? callback(false) : callback(true);
          })
        }
        else {
          callback(false);
        }
      })
    },

    attemptLogin: function (password, callback) {
      Lazarus.logger.log("attempting login")
      Lazarus.Background.fetchPrivateKey(password, function (privateKey) {
        if (privateKey) {
          Lazarus.logger.log("logged in", privateKey);
          //log em in
          Lazarus.Background.privateKey = privateKey;
          callback(true);
        }
        else {
          Lazarus.logger.log("login failed");
          callback(false);
        }
      });
    },

    logout: function (callback) {
      callback = callback || function () { }
      //just remove the privateKey?
      Lazarus.Background.privateKey = null;
      callback(true);
    },

    fetchPrivateKey: function (password, callback) {

      Lazarus.Background.getSetting('privateKey', function (packedEncryptedPrivateKey) {
        password = password || '';
        if (packedEncryptedPrivateKey) {
          try {
            var packedPrivateKey = Lazarus.AES.decrypt(packedEncryptedPrivateKey, password);
            var privateKey = Lazarus.Crypto.unpack(packedPrivateKey);
            if (privateKey) {
              callback(privateKey);
            }
            else {
              callback(null);
            }
          }
          catch (e) {
            //failed to decrypt therefore password is incorrect (or key is corrupt?)
            Lazarus.logger.log("Private-key password protected or corrupt");
            callback(null);
          }
        }
        else {
          throw Error("fetchPrivateKey: No private-key found in database!");
        }
      });
    },


    savePrivateKey: function (privateKey, password, callback) {
      Lazarus.logger.log('saving private key...', privateKey);

      password = password || "";
      callback = callback || function () { }

      //convert the key to a string
      var packedPrivateKey = Lazarus.Crypto.pack(privateKey);
      //encrypt the packed key
      var encryptedPackedPrivateKey = Lazarus.AES.encrypt(packedPrivateKey, password);
      //and save 
      Lazarus.Background.setSetting("privateKey", encryptedPackedPrivateKey, function () {
        Lazarus.logger.log('private key saved.', encryptedPackedPrivateKey);
        callback();
      });
    },


    //removes all saved (and autosaved) forms that have the given domain
    removeSavedFormsByDomain: function (domain, callback) {
      //remove from autosaves
      Lazarus.Background.removeAutosaves(function (formInfo) {
        return (formInfo.domain == domain);
      }, function () {
        //and from the database
        var domainId = Lazarus.Background.hash(domain);
        var now = Lazarus.Utils.timestamp();
        Lazarus.adapter.connect(function (db) {
          var schema = db.getSchema();

          var tFields = schema.table('fields');

          //Lazarus.adapter.exe("UPDATE fields SET status = 1, lastModified = " + now + " WHERE domainId = {domainId}", { domainId: domainId }, function (rs) {
          db.update(tFields)
            .set(tFields.status, 1)
            .set(tFields, lastModified, now)
            .where(tFields.domainId.eq(domainId)).exec()
            .then(function () {
              var tForms = schema.table('forms');
              return db.select(tForms.id).from(tForms)
                .where(tForms.domainId.eq(domainId)).exec().then(function (rows) {
                  //Lazarus.adapter.getColumn("SELECT id FROM forms WHERE domainId = {domainId}", { domainId: domainId }, function (formIds) {
                  if (rows.length > 0) {
                    var formIds = [];
                    for (var i = 0; i < rows.length; ++i)
                      formIds.push(rows[i]['forms']['id']);
                    var tFormFields = schema.table('form_fields');
                    //Lazarus.adapter.exe("UPDATE form_fields SET status = 1, lastModified = " + now + " WHERE formId IN (" + formIds.join(",") + ")", function (rs) {
                    return db.update(tFormFields)
                      .set(tFormFields.status, 1)
                      .set(tFormFields, lastModified, now)
                      .where(tFormFields.formId.in(formIds)).exec()
                      .then(function () {
                        //Lazarus.adapter.exe("UPDATE forms SET status = 1, lastModified = " + now + " WHERE id IN (" + formIds.join(",") + ")", function (rs) {
                        return db.update(tForms)
                          .set(tForms.status, 1)
                          .set(tForms, lastModified, now)
                          .where(tForms.id.in(formIds)).exec()
                          .then(function () {
                            callback(true);
                          });
                      });
                  }
                  else {
                    //nothing to delete
                    callback(true);
                  }
                });
            });
        });
      });
    },



    disableByDomain: function (domain, callback) {
      callback = callback || function () { };

      Lazarus.Background.getSetting("disabledDomains", function (disabledDomains) {
        disabledDomains[domain] = true;
        Lazarus.Background.setSetting("disabledDomains", disabledDomains, function () {
          callback(true);
        });
      }, {});
    },


    saveDisabledDomains: function (callback) {
      Lazarus.Background.setSetting("disabledDomains", Lazarus.Background.disabledDomains, function () {
        callback();
      });
    },


    isURLEnabled: function (url, callback) {

      //only disable on http urls
      if (/^http(s)?:/i.test(url)) {
        var domain = Lazarus.Utils.extractDomain(url);
        Lazarus.Background.isDomainEnabled(domain, function (domainEnabled) {
          if (domainEnabled) {
            callback(true);
          }
          else if (Lazarus.PLATFORM_DISABLED_DOMAINS[Lazarus.platform.id] == domain) {
            callback(false, Lazarus.DISABLED_BY_PLATFORM);
          }
          else {
            callback(false, Lazarus.DISABLED_BY_USER);
          }
        });
      }
      else {
        callback(false, Lazarus.DISABLED_BY_PROTOCOL);
      }
    },


    isDomainEnabled: function (domain, callback) {
      Lazarus.Background.getSetting("disabledDomains", function (disabledDomains) {

        //always disabled in private browsing mode
        if (Lazarus.platform.isPrivateBrowsingEnabled()) {
          callback(false);
        }
        else if (Lazarus.PLATFORM_DISABLED_DOMAINS[Lazarus.platform.id] == domain) {
          callback(false);
        }
        else if (disabledDomains && disabledDomains[domain]) {
          callback(false);
        }
        else {
          callback(true);
        }
      })
    },


    runUpdates: function (callback) {

      Lazarus.getPrefs(["build", "prevVersion"], function (prefs) {
        Lazarus.getExtensionInfo(function (currInfo) {
          Lazarus.Background.runUpdateScripts(function () {
            //ALWAYS save the new version info (if something goes wrong during the update process then
            //do dont want to keep on firing onupdate each time the browser starts)
            Lazarus.setPref("prevVersion", currInfo.version, function () {
              //first install?
              prefs.currVersion = currInfo.version;

              var url = '';

              if (!prefs.build && !prefs.prevVersion) {
                //oninstall
                Lazarus.logger.log("onInstall", currInfo.version);
                if (Lazarus.URL_ONINSTALL && Lazarus.URL_ONINSTALL[Lazarus.updateChannel]) {
                  //url = Lazarus.URL_ONINSTALL[Lazarus.updateChannel];
                }
              }
              else if (Lazarus.Utils.versionCompare(prefs.prevVersion, "<", currInfo.version)) {
                Lazarus.logger.log("onUpdate", prefs.prevVersion, currInfo.version);
                if (Lazarus.URL_ONUPDATE && Lazarus.URL_ONUPDATE[Lazarus.updateChannel]) {
                  url = Lazarus.URL_ONUPDATE[Lazarus.updateChannel];
                }
              }


              if (url) {
                url = Lazarus.Utils.urlAdd(url, {
                  currVersion: currInfo.version,
                  prevVersion: prefs.prevVersion || '',
                  updateChannel: Lazarus.updateChannel,
                  platform: Lazarus.platform.id
                });
                Lazarus.openURL(url);
              }

              callback();
            });
          });
        });
      });
    },


    runUpdateScripts: function (callback) {
      Lazarus.getPref("build", function (prevBuild) {
        if (prevBuild && Lazarus.build > prevBuild) {
          Lazarus.logger.log("updating from " + prevBuild + " to " + Lazarus.build);
          //args is an array of arrays where each internal array is the arguments to pass to the function to be called
          var args = [];
          for (var i = prevBuild + 1; i <= Lazarus.build; i++) {
            if (Lazarus.Updates[i]) {
              args.push([i]);
            }
          }

          if (args.length > 0) {
            var runUpdate = function (id, callback) {
              Lazarus.logger.warn("Running update " + id + "...");
              Lazarus.Updates[id](callback);
            }

            Lazarus.Utils.callAsyncs(runUpdate, args, function (results) {
              //no errors means a successful update, increment the build number
              Lazarus.setPref("build", Lazarus.build, function () {
                Lazarus.logger.log("Update successful");
                callback();
              })
            })
          }
          else {
            //no updates to run
            Lazarus.setPref("build", Lazarus.build, function () {
              callback();
            })
          }
        }
        else {
          //no updates to run
          Lazarus.setPref("build", Lazarus.build, function () {
            callback();
          })
        }
      })
    },


    ajax: function (url, data, callback, options) {
      //TODO: make errors return an error message
      callback = callback || function () { }
      var defaults = {
        method: (data ? 'POST' : 'GET'),
        responseType: 'json',
        noCache: false
      }
      var opts = Lazarus.Utils.extend(defaults, options);

      //prepare the url
      var requestData = '';
      if (data) {
        var pairs = [];
        for (var key in data) {
          pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
        }
        requestData = pairs.join("&");
      }
      if (data && opts.method == "GET") {
        url += (url.indexOf("?") > -1) ? "&" : "?";
        url += requestData;
        requestData = null;
      }
      if (opts.noCache) {
        url += (url.indexOf("?") > -1) ? "&" : "?";
        url += "_=" + Lazarus.Utils.microtime();
      }

      var xhr = new XMLHttpRequest();
      xhr.open(opts.method, url);
      if (opts.method == "POST") {
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
          Lazarus.logger.log("Ajax: response", xhr.status, xhr.responseText);
          if (xhr.status == 304 || (xhr.status >= 200 && xhr.status <= 299)) {
            var response = null;
            try {
              response = JSON.parse(xhr.responseText);
            } catch (e) { }

            if (response) {
              callback(response);
            }
            else {
              Lazarus.logger.error("Ajax: invalid response: " + xhr.responseText);
              callback({ error: 'Non-JSON response', text: xhr.responseText });
            }
          }
          else {
            Lazarus.logger.warn("Ajax: server error: " + xhr.status);
            callback({ error: 'Http Error: ' + (xhr.status || 'Server unavailable') });
          }
        }
      }
      Lazarus.logger.log("Ajax: request", url, data);
      xhr.send(requestData);
    },


    checkForUpdates: function (force, callback) {

      callback = callback || function () { };

      if (Lazarus.platform.id == "chrome" || Lazarus.platform.id == "firefox")
        return callback(null);

      //one day in seconds
      var ONE_DAY = 24 * 60 * 60;

      //I like to keep my browser open for days at a time,
      //so we should see if we need to check once per hour
      if (Lazarus.Background.checkForUpdatesTimer) {
        clearTimeout(Lazarus.Background.checkForUpdatesTimer);
      }
      Lazarus.Background.checkForUpdatesTimer = setTimeout(Lazarus.Background.checkForUpdates, 60 * 60 * 1000);

      Lazarus.getPrefs(["checkForUpdates", "lastUpdateCheck", "guid", "updateChannel"], function (prefs) {

        if (!prefs.guid) {
          prefs.guid = ("{" + Math.random() + "-" + Math.random() + "}").replace(/\./g, "");
          Lazarus.setPref("guid", prefs.guid);
        }
        if (force === true || (prefs.checkForUpdates && (prefs.lastUpdateCheck + ONE_DAY < Lazarus.Utils.timestamp()))) {
          Lazarus.logger.log("checking for updates...");
          var replacements = {
            platform: Lazarus.platform.id,
            version: Lazarus.version,
            //KJD: #329: disabled "check for beta versions" for now
            updateChannel: Lazarus.updateChannel
          };
          var url = Lazarus.Utils.replace(Lazarus.URL_UPDATE_CHECK, replacements);
          //prevent the url from being cached 
          url += "&_=" + Lazarus.Utils.microtime();

          var xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

          //add the users guid for stats
          var data = {
            guid: prefs.guid
          }

          var pairs = [];
          for (var key in data) {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
          }
          var postData = pairs.join("&");

          xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
              if (xhr.status == 304 || (xhr.status >= 200 && xhr.status <= 299)) {
                var response = null;
                try {
                  var response = JSON.parse(xhr.responseText);
                } catch (e) { }

                if (response && response.version) {
                  Lazarus.Background.latestVersionInfo = response;
                  Lazarus.logger.log("update check response", response);
                  //TODO: notify the user that there's a new update available
                  Lazarus.setPref("lastUpdateCheck", Lazarus.Utils.timestamp(), function () {
                    if (Lazarus.Utils.versionCompare(response.version, ">", Lazarus.version)) {
                      //new version available!
                      //what to do?
                      callback(response);
                    }
                    else {
                      callback(response);
                    }
                  })
                }
                else {
                  Lazarus.logger.error("Update check: invalid response: " + xhr.responseText);
                  callback(null);
                }
              }
              else {
                Lazarus.logger.warn("Update check failed: status = " + xhr.status);
                callback(null);
              }
            }
          }
          xhr.send(postData);
        }
      })
    },


    loadAutosaves: function () {
      Lazarus.logger.log("loading autosaved forms...");
      Lazarus.getPref("autosaves", function (autosaveData) {
        if (autosaveData) {

          var data = (autosaveData.indexOf("{") === 0) ? autosaveData : Lazarus.AES.decrypt(autosaveData, Lazarus.Background.hashSeed);

          var autosaves = null;

          if (data) {
            try {
              autosaves = JSON.parse(data);
              Lazarus.logger.log("Autosaved forms loaded.", autosaves);
            }
            catch (e) {
              Lazarus.logger.error("Unable to parse autosaved forms, discarding", data);
            }
          }
          else {
            Lazarus.logger.error("Unable to decrypt autosaved forms, discarding", data);
          }

          Lazarus.Background.autosaves = autosaves;
          Lazarus.Background.saveExpiredAutosaves();
        }
        else {
          Lazarus.logger.log("No autosaves to load");
        }
      });
    }
  }

})();



