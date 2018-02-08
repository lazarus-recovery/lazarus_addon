(function (ns) {
	ns.DatabaseAdapter = function () {

		var self = this;

		self.lf = false;

		switch (Lazarus.platform.id) {
			case "firefox":
				chrome.runtime.onMessage.addListener(Lazarus.onCallBackground);
				self.lf = true;
				Lazarus.db = {};
				break;

			case "chrome":
				chrome.runtime.onMessage.addListener(Lazarus.onCallBackground);
				Lazarus.db = new Lazarus.Database("lazarus3.sqlite");
				break;

			case "safari":
				gEvent.init("background");
				Lazarus.db = new Lazarus.Database("lazarus3.sqlite");

				//we cannot add a button or link to the options page,
				//so we'll have to make do with a checkbox.
				//listen for changes to the advancedOptions chekbox
				//and open the options page if the checkbox is checked.
				safari.extension.settings.addEventListener("change", function (evt) {
					if (evt.key == "advancedOptions" && evt.newValue) {
						//open the options tab
						Lazarus.Background.openOptions();

						//and unselect the option
						//totally unable to stop the checkbox from being set :(
						//evt.newValue = false;
						//evt.preventDefault();
						//evt.stopPropagation();
						//so we'll have to update the setting programatically
						//but this won't update the checkbox until next time the extensions dialog is opened
						safari.extension.settings.setItem("advancedOptions", false);
						return false;
					}
				}, true);
				break;
		}

		self.connect = function (callback) {
			if (self.db)
				callback(self.db);
			else
				self.schemaBuilder.connect({storeType: lf.schema.DataStoreType.INDEXED_DB}).then(function(db) {
					self.db = db;
					callback(db);
				}).catch(function(err){
					callback();
				});
		};

		self.initDatabase = function (callback) {
			Lazarus.logger.log("initializing database...");
			if (self.lf === true) {
				self.schemaBuilder = lf.schema.create('lazarus3');
				
				self.schemaBuilder.createTable('settings').
					addColumn('name', lf.Type.STRING).
					addColumn('value', lf.Type.STRING).
					addColumn('lastModified', lf.Type.INTEGER).
					addColumn('status', lf.Type.INTEGER).
					addPrimaryKey(['name']);

				self.schemaBuilder.createTable('forms').
					addColumn('id', lf.Type.INTEGER).
					addColumn('domainId', lf.Type.INTEGER).
					addColumn('encryption', lf.Type.STRING).
					addColumn('url', lf.Type.STRING).
					addColumn('editingTime', lf.Type.INTEGER).
					addColumn('lastModified', lf.Type.INTEGER).
					addColumn('status', lf.Type.INTEGER).
					addPrimaryKey(['id']);

				self.schemaBuilder.createTable('fields').
					addColumn('id', lf.Type.INTEGER).
					addColumn('domainId', lf.Type.INTEGER).
					addColumn('name', lf.Type.STRING).
					addColumn('type', lf.Type.STRING).
					addColumn('encryption', lf.Type.STRING).
					addColumn('value', lf.Type.STRING).
					addColumn('lastModified', lf.Type.INTEGER).
					addColumn('status', lf.Type.INTEGER).
					addPrimaryKey(['id']);

				self.schemaBuilder.createTable('form_fields').
					addColumn('id', lf.Type.INTEGER).
					addColumn('formId', lf.Type.INTEGER).
					addColumn('fieldId', lf.Type.INTEGER).
					addColumn('lastModified', lf.Type.INTEGER).
					addColumn('status', lf.Type.INTEGER).
					addPrimaryKey(['id']);

				self.schemaBuilder.createTable('domains').
					addColumn('id', lf.Type.INTEGER).
					addColumn('domain', lf.Type.STRING).
					addColumn('editingTime', lf.Type.INTEGER).
					addColumn('lastModified', lf.Type.INTEGER).
					addColumn('status', lf.Type.INTEGER).
					addPrimaryKey(['id']);

				callback();
			}
			else {
				Lazarus.Utils.callAsyncs(Lazarus.db.exe, [
					["CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT, lastModified INTEGER, status INTEGER DEFAULT 0)"],
					["CREATE TABLE IF NOT EXISTS forms (id INTEGER PRIMARY KEY, domainId INTEGER, encryption TEXT, url TEXT, editingTime INTEGER, lastModified INTEGER, status INTEGER DEFAULT 0)"],
					["CREATE TABLE IF NOT EXISTS fields (id INTEGER PRIMARY KEY, domainId INTEGER, name TEXT, type TEXT, encryption TEXT, value TEXT, lastModified INTEGER, status INTEGER DEFAULT 0)"],
					["CREATE TABLE IF NOT EXISTS form_fields (id INTEGER PRIMARY KEY, formId INTEGER, fieldId INTEGER, lastModified INTEGER, status INTEGER DEFAULT 0)"],
					["CREATE TABLE IF NOT EXISTS domains (id INTEGER PRIMARY KEY, domain TEXT, editingTime INTEGER, lastModified INTEGER, status INTEGER DEFAULT 0)"]
				], function () {

					//if a settings_original table exists, then something has gone wrong whilst setting up sync,
					//we should restore the original settings
					Lazarus.adapter.tableExists("settings_original", function (exists) {
						// Lazarus.logger.log("database initialized");
						// if (callback) {
						// 	callback();
						// }
						//rms 
						if (exists) {
							Lazarus.Sync.restoreSettings(function () {
								Lazarus.logger.log("database initialized");
								if (callback) {
									callback();
								}
							});
						}
						else {
							Lazarus.logger.log("database initialized");
							if (callback) {
								callback();
							}
						}
					});
				});
			}
		};

		self.transaction = function (queries, origReplacementsList, callback) {
			if (self.lf === true) {

			}
			else {
				Lazarus.db.transaction(queries, origReplacementsList, callback);
			}
		};
		
		self.getObj = function (query, replacements, callback) {
			if (self.lf === true) {

			}
			else {
				Lazarus.db.getObj(query, replacements, callback);
			}
		};

		self.getStr = function (query, replacements, callback) {
			if (self.lf === true) {

			}
			else {
				Lazarus.db.getStr(query, replacements, callback);
			}
		};
		
		self.exe = function (query, replacements, callback) {
			if (self.lf === true) {

			}
			else {
				Lazarus.db.exe(query, replacements, callback);
			}
		};

		self.getColumn = function (query, replacements, callback) {
			if (self.lf === true) {

			}
			else {
				Lazarus.db.getColumn(query, replacements, callback);
			}
		};

		self.tableExists = function (name, callback) {
			if (self.lf === true) {

			}
			else {
				Lazarus.db.tableExists(name, callback);
			}
		};
	}

})(Lazarus);
