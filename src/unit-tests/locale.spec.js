
console.log("Lazarus.locale", Lazarus.locale);

Lazarus.locale.strings['en'] = {
  "test.title" : "Title",
  "test.default" : "Default",
  "test.replacement" : "Replace {one} string",
  "test.replacement2" : "Replace {test.title} string",
  "test.unicode" : "Español",
  "elapsed.never": "never", 
  "elapsed.none": "now", 
  "elapsed.second": "{time} second ago", 
  "elapsed.seconds": "{time} seconds ago", 
  "elapsed.minute": "{time} minute ago", 
  "elapsed.minutes": "{time} minutes ago", 
  "elapsed.hour": "{time} hour ago", 
  "elapsed.hours": "{time} hours ago", 
  "elapsed.day": "{time} day ago", 
  "elapsed.days": "{time} days ago", 
  "elapsed.week": "{time} week ago", 
  "elapsed.weeks": "{time} weeks ago", 
  "elapsed.month": "{time} month ago", 
  "elapsed.months": "{time} months ago", 
}

Lazarus.locale.strings['es'] = {
  "test.title" : "Title (spanish)"
}
Lazarus.locale.strings['es-XX'] = {
  "test.title2" : "Title (spanish-XX)"
}


describe("Locale", function(){
	
	runTest("should be able to format a string", function(){
		retVal = Lazarus.locale.getString("test.title");
	}, "Title");
  
  it("should throw an error if a string is not found", function(){
		expect(function(){
			retVal = Lazarus.locale.getString("test.nonExistantString")
		}).toThrow("locale string not found 'test.nonExistantString'");
	});
  
  runTest("should be able to replace a value in a string", function(){
		retVal = Lazarus.locale.getString("test.replacement", {one: 1});
	}, "Replace 1 string");
  
  
  runTest("should return a regional string if avaialable", function(){
    Lazarus.locale.setLocale('es-XX');
		retVal = Lazarus.locale.getString("test.title2");
    Lazarus.locale.setLocale('en');
	}, "Title (spanish-XX)");
  
  runTest("should fall back to using the country language if a regional string is not found", function(){
    Lazarus.locale.setLocale('es-XX');
		retVal = Lazarus.locale.getString("test.title");
    Lazarus.locale.setLocale('en');
	}, "Title (spanish)");
  
  runTest("should fall back to using the default language (en) if a country string is not found", function(){
    Lazarus.locale.setLocale('es-XX');
		retVal = Lazarus.locale.getString("test.default");
    Lazarus.locale.setLocale('en');
	}, "Default");
  
  
  runTest("should be able to replace a value in a string with another localised string", function(){
		retVal = Lazarus.locale.getString("test.replacement2");
	}, "Replace Title string");
  
  runTest("should be able to localise an elapsed time", function(){
    var results = [];
    
    results.push(Lazarus.locale.formatElapsedTime(-1));
    results.push(Lazarus.locale.formatElapsedTime(0));
    results.push(Lazarus.locale.formatElapsedTime(1));
    results.push(Lazarus.locale.formatElapsedTime(2));
    results.push(Lazarus.locale.formatElapsedTime(60));
    results.push(Lazarus.locale.formatElapsedTime(120));
    results.push(Lazarus.locale.formatElapsedTime(60 * 60));
    results.push(Lazarus.locale.formatElapsedTime(2 * 60 * 60));
    results.push(Lazarus.locale.formatElapsedTime(24 * 60 * 60));
    results.push(Lazarus.locale.formatElapsedTime(2 * 24 * 60 * 60));
    results.push(Lazarus.locale.formatElapsedTime(7 * 24 * 60 * 60));
    results.push(Lazarus.locale.formatElapsedTime(2 * 7 * 24 * 60 * 60));
    results.push(Lazarus.locale.formatElapsedTime(30 * 24 * 60 * 60));
    results.push(Lazarus.locale.formatElapsedTime(2 * 30 * 24 * 60 * 60));
    
    retVal = results;
	}, [
    'never', 
    'now', 
    '1 second ago', 
    '2 seconds ago', 
    '1 minute ago', 
    '2 minutes ago', 
    '1 hour ago', 
    '2 hours ago', 
    '1 day ago', 
    '2 days ago', 
    '1 week ago', 
    '2 weeks ago', 
    '1 month ago',
    '2 months ago'
  ]);
  

	
});