//var HOST = "http://localhost/mini-pm/server/";
var HOST = "http://ronyehbgu.000webhostapp.com/bgupass/";


function getSHA(plainText) {
	var shaObj = new jsSHA("SHA-256", "TEXT");
	shaObj.update(plainText);
	var hash = shaObj.getHash("HEX");
	return hash;
}

function getHMAC(plainText, key) {
	return CryptoJS.HmacSHA256(plainText, key).toString();
}

function hex2ascii(hexx) {
	var hex = hexx.toString();
	var str = '';
	for (var i = 0; i < hex.length; i += 2)
		str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
	return str;
}

function encrypt(plainText, key) {
	AES_Init();
	var block = new Array(plainText.length);
	for(var i = 0 ; i < plainText.length ; i++) {
		block[i] = plainText[i].charCodeAt(0);
	}
	key = hex2ascii(getSHA(key));
	AES_ExpandKey(key);
	AES_Encrypt(block, key);
	return block
}

function decrypt(encryptedText, key) {
	AES_Init();
	key = hex2ascii(getSHA(key))
	AES_ExpandKey(key);

	AES_Decrypt(encryptedText, key);
	AES_Done();
	var plainText = "";
	for(var i = 0 ; i < encryptedText.length ; i++) {
		if(encryptedText[i] == 0) {
			continue;
		}
		plainText += String.fromCharCode(encryptedText[i]);
	}
	return plainText.trim();
}

function getEncryptKey(password) {
	return getHMAC(password, password + "1");
}

function getAuthenticationKey(password) {
	return getHMAC(password, password + "2");
}

function restore_icon() {
	chrome.storage.local.get("plainemail", function(items) {
		if(items.plainemail) {
			chrome.browserAction.setIcon({path: {"38":"assets/pmon.png"}});
		}
	});
}

//message listener from injected content page to update server passwords file
chrome.extension.onMessage.addListener(
	function(request, sender, sendResponse) {
		if(request.allpass) {	//this massage is for syncing each time immediately
			chrome.storage.local.get(["encmail", "encpass", "password"], function(items) {
				var encryptedFile = JSON.stringify(encrypt(JSON.stringify(request.allpass), getEncryptKey(items.password)));
				var authFile = getHMAC(encryptedFile, getAuthenticationKey(items.password));
				$.ajax({
					type: "POST",
					url: HOST + "ser.php?",
					data: {'email': items.encmail,	// syncing with rsa encrypted mail
							'password': items.encpass,
							'file': encryptedFile,
							'authFile': authFile},
					success: function(response) {
						if(response != "error" && response != "2") {
							console.log("server: " + response);
						}
						else
							alert("server parse error-please fix it and check if password saved"); 
					},
					error: function(xhr, desc, err) {
						console.log(xhr);
						console.log("Details: " + desc + "\nError: " + err);
						alert("server is down, pass was saved locally only. please start server and logout for re-syncing");
					}
				});	
			});	
		}
	});

//this message updates the extension badge
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.badgeText) {
		chrome.tabs.get(sender.tab.id, function(tab) {
			if (chrome.runtime.lastError) {
				return; // the prerendered tab has been nuked, happens in omnibox search
			}
			if (tab.index >= 0) { // tab is visible
				chrome.browserAction.setBadgeText({tabId:tab.id, text:message.badgeText});
				chrome.browserAction.setTitle({tabId:tab.id, title: "You have " + message.badgeText + " password inputs at this page.\nClick on the field and the password will appear."});
			} else { // prerendered tab, invisible yet, happens quite rarely
				var tabId = sender.tab.id, text = message.badgeText;
				chrome.webNavigation.onCommitted.addListener(function update(details) {
					if (details.tabId == tabId) {
						chrome.browserAction.setBadgeText({tabId: tabId, text: text});
						chrome.browserAction.setTitle({tabId:tab.id, title: "You have " + message.badgeText + " password inputs at this pageץ\nClick on the field and the password will appear."});
						chrome.webNavigation.onCommitted.removeListener(update);
					}
				});
			}
		});
	}
});

restore_icon();