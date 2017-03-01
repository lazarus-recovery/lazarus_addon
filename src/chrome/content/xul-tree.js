
this.Tree = this.Tree || {};

/**
* make a tree sortable
*/
Tree.Sorter = function(tree){

    //event handlers change the "this" object
    var _this = this;
    
    //keep a reference to the tree
    _this.tree = tree;
    
    //the original (full) set of data for the tree
    _this.tree.origData = _this.tree.origData || null;
    
    //the current dataset
    _this.tree.data = _this.tree.data || null;
    
    
    /**
    * prepares a value for the compare function
    */
    _this.prepareForSort = function(val){
        if (val === null){return ""}
        switch (typeof val){
            case "string":
                val = val.toLowerCase();
                break;
                
            case "number":
            default:
                //do nothing
        }
        return val;
    }
    
    /**
    * sorts the data by the given column
    */
    _this.sortData = function(columnId, desc){
    
        //build a sorting function for this column
        //TODO: expens sorting function to handle different datatypes (numbers/strings/dates) 
        var sortFn = function(a, b){
            var aa = _this.prepareForSort(a[columnId]);
            var bb = _this.prepareForSort(b[columnId]);
            
            if (aa < bb){
                return -1;
            }
            else if (aa > bb){
                return 1;
            }
            else {
                return 0;
            }  
        }
        
        //and sort the current dataset using this function
        _this.tree.data.sort(sortFn);
        if (desc){
            _this.tree.data.reverse();
        }
        
        //and set view
        _this.tree.refresh(); 
    }
    
    
    /**
    * 
    */
    _this.onColumnClick = function(evt){
        //make sure this is a treecol and not an element within the column
        var ele = evt.target;
        while(ele && ele.nodeName != "treecol"){
            ele = ele.parentNode;
            if (!ele){
                throw Error("Tree.Sorter: Unable to find column clicked");
            }
        }
        
        //check by putting extra element within the 
        _this.sortByColumn(ele);
    }
    
    /**
    * 
    */
    _this.sortByColumn = function(sortColumn, dir){
       
        //only sort columns with a sort id attribute
        var id = sortColumn.getAttribute("id");
        
        if (id && sortColumn.getAttribute("sortable") !== "false"){
            dir = dir || ((sortColumn.getAttribute("sortDirection") == "descending") ? "ascending" : "descending");
            //set the sort direction on the various columns
            //setting these will make the sort option persist
            _this.tree.setAttribute("sortDirection", dir);
        	_this.tree.setAttribute("sortId", id);
            
            //and update the sort direction
            for (var i=0; i<_this.treeColumns.length; i++){
                _this.treeColumns[i].setAttribute("sortDirection", (_this.treeColumns[i] == sortColumn) ? dir : "");
            }
            _this.sortData(id, dir == "descending");
            return true;
        }
        else {
            return false;
        }
    }
    
    
    /**
    * attach event handlers to the tree
    */
    _this.initTree = function(){
        _this.treeColumns = _this.tree.getElementsByTagName("treecol");
        
        for (var i=0; i<_this.treeColumns.length; i++){
            _this.treeColumns[i].addEventListener("click", _this.onColumnClick, false);
        }
        
        var filterBoxId = _this.tree.getAttribute("filterbox");
        if (filterBoxId){
            _this.filterBox = document.getElementById(filterBoxId);
            if (_this.filterBox){
                _this.filterBox.addEventListener("keyup", _this.onFilterChange, false);
            }
            else {
                throw Error("Tree.Sorter: Unable to find filterbox ["+ filterBoxId +"]");
            }
        }
    }
    
    /**
    * sets the initial dataset
    */
    _this.tree.initData = function(data){
        //save a copy of the original dataset
        _this.tree.origData = data;
        _this.tree.data = data;
        
        //sort the data by the saved sort column
        var initSortColumn = document.getElementById(_this.tree.getAttribute("sortId"));
        
        if (initSortColumn && _this.sortByColumn(initSortColumn, _this.tree.getAttribute("sortDirection"))){
            //all good data filled in
        }
        else {
            //need to fill in the data
            _this.tree.refresh();
        }
    }
    
    /**
    * 
    */
    _this.getFilteredData = function(){
    
        var filter = (_this.filterBox && _this.filterBox.value) ? Tree.trim(_this.filterBox.value) : '';
        
        if (filter){
            filter = _this.prepareForSort(filter);
            var filtered = [];
            for (var i=0; i<_this.tree.origData.length; i++){
                var include = false;
                for(var id in _this.tree.origData[i]){
                    if (_this.prepareForSort(_this.tree.origData[i][id]).toString().indexOf(filter) > -1){
                        include = true;
                        break;
                    }
                }
                if (include){
                    filtered.push(_this.tree.origData[i]);
                }
            }
            return filtered;
        }
        else {
            return _this.tree.origData;
        }
    }
    
    _this.onFilterChange = function(){
    
        if (_this.timerRunFilter){
            clearTimeout(_this.timerRunFilter);
        }
        _this.timerRunFilter = setTimeout(_this.tree.filterData, 200);
    }
    
    /**
    * filter the data
    */
    _this.tree.filterData = function(){
        _this.tree.data = _this.getFilteredData();
        _this.tree.refresh();    
    }
    
    /**
    * updates the current view
    */
    _this.tree.refresh = function(fullRefresh){
    
        var data = _this.tree.data;
        
        //keep the tree looking at the same row (if possible)
        var topRow = _this.tree.treeBoxObject.getFirstVisibleRow();
        _this.tree.view = new _this.tree.nsITreeView(data);
        _this.tree.data = data;
        if (topRow){
            _this.tree.treeBoxObject.scrollToRow(topRow);
        }
    }
    
    /**
    * a simplistic nsITreeView for sorting by data value.
    * This function should be overwritten if the tree needs a more complex view.
    * If an nsITreeView is already attached then we will use that instead.
    */
    _this.tree.nsITreeView = _this.tree.nsITreeView || function(data){
        this.rowCount = data.length;
        this.getCellText = function(row, col){
            return data[row][col.id];
        };
        this.getCellValue = function(row, col){
            return data[row][col.id];
        };
        this.setTree = function(treebox){
            this.treebox = treebox;
        };
        this.isEditable = function(row, col){
            return col.editable;
        };
        this.getImageSrc = function(row, col){}
        this.isContainer = function(row){return false;};
        this.isSeparator = function(row){return false;};
        this.isSelectable = function(){};
        this.isSorted = function(){return false;};
        this.getLevel = function(row){return 0;};
        this.getImageSrc = function(row, col){return null;};
        this.getRowProperties = function(row, props){};
        this.getCellProperties = function(row, col, props){};
        this.getColumnProperties = function(colid, col, props){};
        this.cycleHeader = function(col, elem){};
    }
    
    _this.initTree();
}

/**
* trim whitespace from beginning and end of a string
*/
Tree.trim = function(str){
    return str.replace(/^\s+/, '').replace(/\s+$/, '');
}

/**
* finds all tree elements with class of "sortable" and converts 
* them into sortable trees
*/
Tree.Sorter.initDoc = function(){
    var trees = document.getElementsByTagName("tree");
    for (var i=0; i<trees.length; i++){
        if (Tree.hasClass(trees[i], "sortable")){
            new Tree.Sorter(trees[i]);
        }
    }
}


/* == helper functions == */

/**
* return TRUE if element has this class 
*/
Tree.hasClass = function(ele, needle){
    var eleClass = " "+ ele.getAttribute("class").toLowerCase().replace(/\s+/g, " ") +" ";
    return (eleClass.indexOf(" "+ needle.toLowerCase() +" ") > -1);
}
