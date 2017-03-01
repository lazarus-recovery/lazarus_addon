
Lazarus.file = {};

//cache the file separator to prevent multiple lookups
Lazarus.file.FILE_SEPARATOR = null;

/**
* delete a file or folder
*/
Lazarus.file.kill = function(path){
    var file = Lazarus.file.getFile(path);
    if (file.exists()){
        file.remove(true);
    }
}

/**
* return TRUE if file exists and is a file or a directory
*/
Lazarus.file.exists = function(path){
    return Lazarus.file.getFile(path).exists();
}

/**
* return an nsIFile object for the given path
*/
Lazarus.file.getFile = function(path){
    path = Lazarus.file.fixPath(path);
    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(path);
    return file;
}

/**
* fix slashes in a path to match the OS
*/
Lazarus.file.fixPath = function(path){

    //allow the path to start with special paths
    var m = path.match(/^%(\w+)%/);
    if (m){
        path = path.replace(m[0], Lazarus.file.getSpecialDir(m[1]));
    }

    if (!Lazarus.file.FILE_SEPARATOR){
        var profilePath = Lazarus.file.getSpecialDir("profile");
        Lazarus.file.FILE_SEPARATOR = (profilePath.indexOf("/") > -1) ? "/" : "\\";
    }
    return path.replace(/[\/\\]/g, Lazarus.file.FILE_SEPARATOR);
}

/**
* return the path to a special directory
* directory names can be given in mozilla speak (eg "ProfD") or english ("profile")
*/
Lazarus.file.getSpecialDir = function(dirName){
    
    switch (dirName.toLowerCase()){
        case "profd":
        case "profile":
            dirName = "ProfD";
            break;
        
        default:
            //assume programmer knows what he's doing and is asking for a valid directory.
    }
    
    return Components.classes["@mozilla.org/file/directory_service;1"]
         .getService(Components.interfaces.nsIProperties)
         .get(dirName, Components.interfaces.nsIFile).path;
}

/**
* copy a file from src to dest
*/
Lazarus.file.copy = function(src, dest, overwrite){
    var srcFile = Lazarus.file.getFile(src);
    dest = Lazarus.file.fixPath(dest);
    
    var m = dest.match(/(.+)[\\\/]([^\\\/]+$)/);
    var destFilename = m ? m[2] : dest;
    var destPath = m ? m[1] : srcFile.parent.path;
    
    var destDir = Lazarus.file.getFile(destPath);
    
    if (overwrite){
      Lazarus.file.kill(dest);
    }
    srcFile.copyTo(destDir, destFilename);
}

/**
* move a file from src to dest
*/
Lazarus.file.move = function(src, dest, overwrite){
    var srcFile = Lazarus.file.getFile(src);
    dest = Lazarus.file.fixPath(dest);
    
    var m = dest.match(/(.+)[\\\/]([^\\\/]+$)/);
    var destFilename = m ? m[2] : dest;
    var destPath = m ? m[1] : srcFile.parent.path;
    
    var destDir = Lazarus.file.getFile(destPath);
    if (overwrite){
      Lazarus.file.kill(dest);
    }
    srcFile.moveTo(destDir, destFilename);
}
