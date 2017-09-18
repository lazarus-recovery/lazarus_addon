
import sys, os, shutil, zipfile, glob, re, fnmatch


def rename(src, dest):
  """moves a file or directory from src to dest
  overwriting dest if nessassary"""  
  
  src = os.path.realpath(src)
  dest = os.path.realpath(dest)
  
  #remove the dest directory if it doesn't already exist
  if exists(dest):
    kill(dest)
  os.rename(src, dest);

def copy(src, dest):
  """copies a file from src to dest
  creating dest path if nessassary"""  
  
  src = os.path.realpath(src)
  dest = os.path.realpath(dest)
  
  #make the dest directory if it doesn't already exist
  destpath = os.path.dirname(dest)
  if not os.path.isdir(destpath):
    os.makedirs(destpath)
  
  #now copy the file
  shutil.copyfile(src, dest)


def copyTree(src, dest, excludeDirs=[], excludeFiles=[]):
  
  for root, dirs, files in os.walk(src):
    for dir in dirs:
      if (dir in excludeDirs):
        dirs.remove(dir)
        
    for file in files:
      filepath = os.path.join(root, file)
      excluded = False
      for pattern in excludeFiles:
        if (fnmatch.fnmatch(filepath, pattern)):
          excluded = True
      
      if (not excluded):
        destpath = os.path.join(root, file).replace(src, dest, 1)
        copy(filepath, destpath)
        

def read(src):
  file = open(os.path.realpath(src), "rb")
  str = file.read()
  file.close()
  return str
  
def readLines(src, removeNewlineChars):
  file = open(os.path.realpath(src), "rb")
  lines = file.readlines()
  if (removeNewlineChars):
    for i in range(len(lines)):
      line = lines[i]
      while (line != "" and (line[-1] == "\r" or line[-1] == "\n")):
        line = line[0: len(line)-1]
        
      lines[i] = line
      
  file.close()
  return lines

def write(dest, data):
  file = open(os.path.realpath(dest), "wb")
  file.write(data)
  file.close()



def zipFolder(src, dest, compress=True, excludeDirs=[]):
  """compresses a folder and all of it's files"""
  
  dest = os.path.realpath(dest)
  src = os.path.realpath(src)
  method = zipfile.ZIP_DEFLATED
  if not compress:
    method = zipfile.ZIP_STORED
    
  zip = zipfile.ZipFile(dest, 'w', method)
  for root, dirs, files in os.walk(src):
    
    excluded = False
    for pattern in excludeDirs:
      if (fnmatch.fnmatch(root, pattern)):
        excluded = True
    
    if (not excluded):   
      for fileName in files:  
        filepath = os.path.join(root, fileName)
        if (filepath != dest): 
          #path should be relative to src
          zippath = filepath.replace(src, "", 1);
          zip.write(filepath, zippath)
        
  zip.close()



def exists(path):
  """return TRUE if file/folder exists"""
  return os.path.exists(os.path.realpath(path))



def kill(search):
  """deletes files or folders and all their content"""
  
  files = glob.glob(search)
  for filename in files:
    if (os.path.isfile(filename)):
      os.remove(filename)
    elif (os.path.isdir(filename)):
      shutil.rmtree(filename)
    else:
      raise NameError('Unable to kill "'+ filename +'"\nOnly files and directories may be killed')



def regexReplace(filename, regex, replace, newFilename=None):
  """Replaces all occurances of a string in a file"""
  #read the file as a string
  file = read(filename)
  
  #make replacements
  file = re.sub(regex, replace, file)
  
  #and save
  if (newFilename == None):
    newFilename = filename
  write(newFilename, file)
  


def strReplace(filename, search, replace, newFilename=None):
  """Replaces all occurances of a string in a file"""
  #read the file as a string
  file = read(filename)
  
  #make replacements
  #TODO: support for regular expression replacements.  
  #search is just a string
  file = file.replace(search, replace)
  
  #and save
  if (newFilename == None):
    newFilename = filename
  write(newFilename, file)
  
#test
#zipFolder("C:\\xpi-dev\\lazarus\\_tmp_xpi", "test.zip", False)


def find(regexStr, rootdir, recursive=False):
  """Returns a list of filenames that match the given regular expression"""
  regex = re.compile(regexStr)
  found = []
  for root, dirs, files in os.walk(rootdir):
    for file in files:
      if (re.search(regex, file)):
        found.append(os.path.join(root, file))
  
  return found
  
#test
#print(find("^entries$", "C:\\xpi-dev\\lazarus\\xpi\\", True))

  