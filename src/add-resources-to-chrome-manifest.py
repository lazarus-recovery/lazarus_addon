#add the list of all non-svn files to chrome's manifest.json file
#gee thanks for making me do this chrome, wouldn't it have been easier to add wildcards (eg images/*.png*)?

import os, kfile, json


def findFiles(rootdir):
  """Returns a list of filenames that match the given regular expression"""
  found = []
  for root, dirs, files in os.walk(rootdir):
    if '.svn' in dirs:
      dirs.remove('.svn')
      
    for file in files:
      filename = os.path.join(root, file).replace("./", "").replace("\\", "/")
      found.append(filename)
  
  return found
  

#list all the files
files = findFiles('./')

#open the manifest.json file
manifest = json.loads(kfile.read('manifest.json'));
manifest["web_accessible_resources"] = files    
kfile.write('manifest.json', json.dumps(manifest, indent=2));
    