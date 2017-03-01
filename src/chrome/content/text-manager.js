

//load translations from the browser
Lazarus.getString = Lazarus.getBrowser().Lazarus.getString;
Lazarus.db = Lazarus.getBrowser().Lazarus.db;
Lazarus.decrypt = Lazarus.getBrowser().Lazarus.decrypt;
Lazarus.hashQuery = Lazarus.getBrowser().Lazarus.hashQuery;


LazarusTextManager = {

    /**
    * steup this window
    */
    init: function(){
        window.removeEventListener("load", LazarusTextManager.init, true);
        Lazarus.$('tree-search').addEventListener("keydown", LazarusTextManager.onSearchKeyDown, true);
        LazarusTextManager.initTree();
        if (Lazarus.getPref('extensions.lazarus.disableSearch')){
            //disable the search functionality
            Lazarus.$('tree-search').disabled = true;
            Lazarus.$('message-search').hidden = true;
            //and show the "search is disabled" message 
            Lazarus.$('message-search-disabled').hidden = false;
        }
        window.sizeToContent();
    },
    
    
    /**
    * setup the XULTree
    */
    initTree: function(){
        var tree = Lazarus.$('tree-text');
        var sorter = new Tree.Sorter(tree);
        
        //we need to build an nsiTreeView object to tell the tree how to display the fields
        tree.nsITreeView = function(data){
            this.rowCount = data.length;
            this.getCellText = function(row, col){
                
                switch (col.id){  
                    case "created":
                        return Lazarus.formatDate(new Date(data[row]["created"] * 1000));
                    
                    case "url":
                        if (!data[row]["url"]){
                            data[row]["url"] = Lazarus.decrypt(tree.data[row]["url_encrypted"]);
                        }
                        return data[row]["url"];
                        
                    case "text":
                        //cache the results, as decryption is CPU intensive
                        if (!data[row]["summary"]){
                            data[row]["summary"] = Lazarus.decrypt(data[row]["summary_encrypted"]) || ("["+ Lazarus.getString("untitled") +"]");
                        }
                        return data[row]["summary"];
                        
                    default:
                        return data[row][col.id];
                }
            };
            
            this.getCellValue = function(row, col){
                return data[row][col.id];
            };
            
            this.setCellValue = function(row, col, val){
                switch (col.id){    
                    case "check":
                        data[row][col.id] = (val == "true") ? true : false;
                        LazarusTextManager.refreshDeleteSelectedButton();            
                        return;
                }
            };
            this.setTree = function(treebox){this.treebox = treebox;};
            this.isEditable = function(row, col){
                return col.editable;
            }
            this.getImageSrc = function(row, col){
                switch (col.id){
                    case "recoverText":
                        return 'chrome://lazarus/skin/recover-form.png';
                        
                    default:
                        return null;
                }
            }
            this.isContainer = function(row){return false;};
            this.isSeparator = function(row){return false;};
            this.isSelectable = function(){};
            this.isSorted = function(){return false;};
            this.getLevel = function(row){return 0;};
            this.getRowProperties = function(row, props){};
            this.getCellProperties = function(row, col, props){     
                switch (col.id){
                    //make the formURL look like a text-link
                    case "url":
                        var aserv=Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
                        props.AppendElement(aserv.getAtom("lazarustextlink"));
                        return "lazarustextlink";
                        break;
                    
                    default:
                        break;
                }
            };
            this.getColumnProperties = function(colid, col, props){};
            this.cycleHeader = function(col, elem){};
            this._getDataRowById = function(id){
                for (var i=0; i<data.length; i++){
                    if (data[i]["id"] == id){
                        return data[i];
                    }
                }
                return null;
            }
        }
        
        //now we need to get some data and insert it into the tree
        //load the list of text and forms from the database
				var query = "SELECT id, url_encrypted, created, summary_encrypted, 'textdata' as `table` FROM textdata UNION ALL SELECT id, formurl, created, formtext, 'forms' FROM forms ORDER BY created DESC";

				var rs = Lazarus.db.rs(query);
		
        tree.initData(rs);
        tree.columns.restoreNaturalOrder();
        
        tree.addEventListener("click", function(event){
            //REF: http://developer.mozilla.org/en/docs/Code_snippets:Tree
            // get the row, col and child element at the point
            var row = {}, col = {}, child = {};
            var tbo = tree.treeBoxObject;
            tbo.getCellAt(event.clientX, event.clientY, row, col, child);
            //get the colId and row
            //user clicked a column header
            if (!col.value){return}
            var colId = (col.value && typeof col.value == "string") ? col.value : col.value.id;
            var rowNum = row.value;
            //make sure we clicked on a valid row
            if (rowNum < 0 || rowNum >= tree.data.length){return}
            tree.onCellClick(rowNum, colId, child);
        }, true);
        
        /**
        * handle click within the tree
        */
        tree.onCellClick = function(row, colId, child){
            
            switch(colId){
                case "url":
                    //navigate to given url
                    if (!tree.data[row]["url"]){
                        tree.data[row]["url"] = Lazarus.decrypt(tree.data[row]["url_encrypted"]);
                    }
                    var url = tree.data[row]["url"];
                    Lazarus.getBrowser().Lazarus.openURL(url, true, true);
                    //and close the dialog
                    //NO, don't close, they may have got the wrong url 
                    //window.close();
                    return;
                    
                case "recoverText":
                    window.openDialog("chrome://lazarus/content/text-recover.xul?id="+ tree.data[row]["id"] +"&table="+ tree.data[row]["table"], "lazarusTextRecover", "chrome,modal,centerscreen,dialog=no");
                    return;
                    
                default:
                    //let the tree select this row.
                    return;
            }
        }
    },
    
    onSearchKeyDown: function(evt){
        
        //stop the dialog from closing when you hit [enter] or escape?
        if (evt.keyCode == 13){
            evt.stopPropagation();
            evt.preventDefault();
        }
        
        //do a search as soon as the user stops typing.
        if (LazarusTextManager.timerRunSearch){
            clearTimeout(LazarusTextManager.timerRunSearch);
        }
        LazarusTextManager.timerRunSearch = setTimeout(LazarusTextManager.runSearch, 250);
    },
    
    
    /**
    * 
    */
    runSearch: function(){
        
        var rs;
        var query = Lazarus.trim(Lazarus.$('tree-search').value);
				var sortDirection = Lazarus.$('created').getAttribute("sortDirection");
				
        if (query){
            var hashedQuery = Lazarus.hashQuery(query);
						
						//we should really join the two tables, but that's going to have to wait until Lazarus 3.0 (to much work at this point)
            rs = Lazarus.db.rs("SELECT id, url_encrypted, created, summary_encrypted, 'textdata' as `table` FROM textdata JOIN textdata_fulltext ON textdata.id = textdata_fulltext.docid WHERE textdata_fulltext.hashed_text MATCH ?1", hashedQuery);
						//and search forms as well
						var rsForms = Lazarus.db.rs("SELECT id, formurl as url_encrypted, created, formtext as summary_encrypted, 'forms' as `table` FROM forms JOIN forms_fulltext ON forms.id = forms_fulltext.docid WHERE forms_fulltext.hashed_text MATCH ?1", hashedQuery);
						
						//and join the forms with the text
						rs = rsForms ? rs.concat(rsForms) : rs;
						
						//and sort in the correct order
						rs.sort(function(a, b){
							return (a.created > b.created) ? 1 : -1;
						});
						
						//if sort is by date desc, then we need to invert the Array
						if (sortDirection == "descending"){
							rs.reverse();
						}
        }
        else {
						var desc = (sortDirection == "descending") ? " DESC" : "";
            rs = Lazarus.db.rs("SELECT id, url_encrypted, created, summary_encrypted, 'textdata' as `table` FROM textdata UNION ALL SELECT id, formurl, created, formtext, 'forms' FROM forms ORDER BY created"+ desc);
        }
        
        //highlight the warning about using full words to search for stuff if there are no results
        var classname = (rs.length == 0) ? "warning" : "";
        Lazarus.$('message-box').setAttribute("class", classname);
        
        var tree = Lazarus.$('tree-text');
        tree.data = rs;
        tree.refresh(); 
        LazarusTextManager.refreshClearSearchButton();
    },
    
    
    /**
    * toggle all of the checkboxes in the tree on or off.
    */
    toggleAll: function(){
        var checked = !Lazarus.$('select-all').checked;
        var tree = Lazarus.$('tree-text');
        for (var i=0; i<tree.data.length; i++){
            tree.data[i]["check"] = checked;
        }
        Lazarus.$('select-all').checked = checked;
        LazarusTextManager.refreshDeleteSelectedButton();
    },
    
    
    /**
    * "delete selected" button pushed 
    */
    onDeleteSelected: function(){
        //do we have any selected textdata?
        var ids = LazarusTextManager.getSelectedIds();
        if (ids.length == 0){
            //shouldn't be able to get here
            alert(Lazarus.getString("LazarusTextManager.noItemsSelected"));
        }
        else if (confirm(Lazarus.getString("LazarusTextManager.confirmDelete"))){
						var forms = [];
						var texts = [];
						
						for(var i=0; i<ids.length; i++){
							if (ids[i].table == "textdata"){
								texts.push(ids[i].id);
							}
							else if (ids[i].table == "forms"){
								forms.push(ids[i].id);
							}
							else {
								throw Error("Unknown table type ["+ ids[i].table +"]");
							}
						} 
				
            //remove the forms, and re-search
						if (texts.length > 0){
							Lazarus.db.exe("DELETE FROM textdata WHERE id IN ("+ texts.join(",") +")");
							Lazarus.db.exe("DELETE FROM textdata_fulltext WHERE docid IN ("+ texts.join(",") +")");	
						}
						
						if (forms.length > 0){
							Lazarus.db.exe("DELETE FROM forms WHERE id IN ("+ forms.join(",") +")");
							Lazarus.db.exe("DELETE FROM forms_fulltext WHERE docid IN ("+ texts.join(",") +")");	
						}
            
            LazarusTextManager.runSearch();
        }
    },
    
    /**
    * clear the searchbox
    */
    clearSearch: function(){
        Lazarus.$('tree-search').value = "";
        Lazarus.$('tree-text').filterData();
    },
    
    
    /**
    * enable/disable the clear search button
    */
    refreshClearSearchButton: function(){
        //Lazarus.$('clear-search').disabled = Lazarus.$('tree-search').value ? false : true;
    },
    
    
    /**
    * enable/disable the clear search button
    */
    refreshDeleteSelectedButton: function(){
        Lazarus.$('delete-selected').disabled = (LazarusTextManager.getSelectedIds().length == 0);
    },
    
    
    /**
    * return an array of id's of the currently selected textdata items
    */
    getSelectedIds: function(){
        var ids = [];
        var data = Lazarus.$('tree-text').data;
        for (var i=0; i<data.length; i++){
            if (data[i]["check"]){
                ids.push({id:data[i]["id"], table:data[i]["table"]});
            }
        }
        return ids;
    }

}





window.addEventListener("load", LazarusTextManager.init, true);