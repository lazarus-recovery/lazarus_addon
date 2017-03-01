

function toggleExpireSaveForms(checkbox){
	document.getElementById("extensions-lazarus-expireSavedFormsInterval").disabled = !checkbox.checked;
	document.getElementById("extensions-lazarus-expireSavedFormsUnit").disabled = !checkbox.checked;
}
