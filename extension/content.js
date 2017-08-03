//retrieve all input password fields and if this url exist in our passwords file - then assign it to the fields.
var currentURL = document.location.href;
var list = document.getElementsByTagName("input");
chrome.storage.local.get({logedon: "no pass"}, function(items) {
	var allPasswords = items.logedon;
	if (allPasswords === "no pass") {
		console.log("no password file - you're probably not logged in");
		return;
	}
	else if (allPasswords[currentURL] == undefined) {
		console.log("no password in server for URL: " + currentURL) ;
		return;
	}
	else {
		var counter = 0;
		for(var i = 0 ; i < list.length ; i++) {
			if(list[i].type === "password") {
				list[i].onfocus = function() {
					this.value = allPasswords[currentURL];
					this.style.background = "PowderBlue";
				};
				console.log("password was found in server for URL: " + currentURL);
				counter++;
			}
		}
		if (counter) 
			chrome.runtime.sendMessage({badgeText: counter.toString()});
	}
});

//add listener to all forms and ask user if he or she wants to save the password of the specific submitted form
$("form").each(function () {
	var $this = $(this);
	$this.submit(function () {
		console.log("form submitted");
		var list = $this.find(':input');
		chrome.storage.local.get({logedon: "no pass"}, function(items) {
			var allPasswords = items.logedon;
			if(allPasswords === "no pass") 
				console.log("no password file (cannot store the password) - you probably not logged in");
			else {
				console.log(list);
				for(var i = 0 ; i < list.length ; i++) {
					if(list[i].type === "password" && list[i].value !== "") {
						if(allPasswords[currentURL] == undefined)
							var ans = confirm("do you want save your password for URL: " + currentURL + "?");
						else if (allPasswords[currentURL] != list[i].value)
							var ans = confirm("do you want update your password for URL: " + currentURL + "?");
						else 
							break; // typed password matched to the one we keep and no need to save or update
						if (ans === true) {
							allPasswords[currentURL] = list[i].value;
							chrome.storage.local.set({logedon: allPasswords});
							chrome.runtime.sendMessage({allpass: allPasswords}); //send all password to background page to Ajax update the server
							break;
						}
					}
				}
			}
		});
		return true;
	});
});