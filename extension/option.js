/*
	set host below and also in background page to http://ronyehbgu.000webhostapp.com/bgupass/
	or local host for your wamp http://localhost/mini-pm/server/

	************** orian and ron password manager *****************
	************ mini project in computer security ****************
*/
// var HOST = "http://localhost/mini-pm/server/";
var HOST = "http://ronyehbgu.000webhostapp.com/bgupass/";
var DEBUG_MODE_ON = 1;

if (!DEBUG_MODE_ON) {
	console = console || {};
	console.log = function() {};
}

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
	plainText = "";
	for(var i = 0 ; i < encryptedText.length ; i++) {
		if(encryptedText[i] == 0) {
			continue;
		}
		plainText += String.fromCharCode(encryptedText[i]);
	}
	return plainText.trim();
}

// we are deriving the secrets instead of just sha-256, with sha-256 based hmac
function getSignUpPassword(password) {
	return getHMAC(password, password + "0");
}

function getEncryptKey(password) {
	return getHMAC(password, password + "1");
}

function getAuthenticationKey(password) {
	return getHMAC(password, password + "2");
}

function getEmailHMACform(email) {
	return getHMAC(email, email + "3");
}

// Restores options page if user was logged in 
// stored in chrome.storage.
function restore_options() {
	var passfile = chrome.storage.local.get(["logedon", "plainemail", "encmail", "password", "encpass", "signuppassword"], function(items) {
		if(items.logedon) {
			document.forms[0].classList.add("displayornot");
			document.getElementById('logoutdiv').classList.remove("displayornot");
			document.getElementById('tbmanagediv').classList.remove("displayornot");
			document.getElementById('loginTitle').classList.add("displayornot");
			console.log("your email is: " + items.plainemail);
			console.log("your rsa mail is: " + items.encmail);
			console.log("your derived password for login is: " + items.signuppassword);
			console.log("your rsa password is: " + items.encpass);
		}
	});
}

// get public ket ajax and login ajax
document.getElementById("login").onclick = function() {
	var rsa = new RSAKey();
	$.ajax({
		type: "POST",
		url: HOST + "login.php?",
		data: {'pk': "publickey_request"},
		success: function(response) {
			console.log("received server key modulus and exponent:");
			console.log(response);
			var res = JSON.parse(response);
			rsa.setPublic(res[0], res[1]); // building public key from modulus and exponent	that comes from this response
			var plainemail = document.forms[0].email.value;
			console.log("your email is: " + plainemail);
			var hmacmail = 	getEmailHMACform(plainemail);
			console.log("your hmac form mail value is: " + hmacmail);
			//from now and on email treated as rsa and hmac-hashed.
			var masterPassword = document.forms[0].password.value;
			console.log("your master password value is: " + masterPassword);
			var signuppassword= getSignUpPassword(masterPassword);
			console.log("your sign-up derived password for login is: " + signuppassword);
			
			var encmail = rsa.encrypt(hmacmail); // encrypting hmac-mail-value with public key
			var encpass = rsa.encrypt(signuppassword); // encrypting hmac-master-password-value with public key
			loginajax(plainemail, encmail, masterPassword, signuppassword, encpass);	// now calling the login ajax
		},
		error: function(xhr, desc, err) {
			console.log(xhr);
			console.log("Details: " + desc + "\nError: " + err);
			document.getElementById("loginmsg").innerHTML="error connecting to server. server is down probably.";
			setTimeout(function(){document.getElementById("loginmsg").innerHTML = ""}, 3000);
		}
	});
}
//called after receiving RSA key to preform login with any encrypted values we like.
function loginajax(plainemail, encmail, masterPassword, signuppassword, encpass) {
	console.log("your RSA encrypted hmac-mail value is:");
	console.log(encmail);
	console.log("your RSA encrypted hmac-signup-password value is:");
	console.log(encpass);
	
	$.ajax({
		type: "POST",
		url: HOST + "login.php?",
		data: {'email': encmail, 'password': encpass}, //sending RSA encrypted email and password values!
		success: function(response) { // response on success should be object with 2 fields, the password file and its authentication value.
			if(response === "fnf") {
					alert("WARNING! your password file has been deleted. please report to us and create a new account.");
					return;
				}
			if(response !== "2" && response !== "no such user" && response !== "wrong pass") {
				console.log(response);
				response = JSON.parse(response);
				var localAuthFile = getHMAC(JSON.stringify(response.passfile), getAuthenticationKey(masterPassword));
				if(response.authfile !== localAuthFile) {
					alert("WARNING! The authentication of the password file mismatched. Maybe someone changed the file.");
					return;
				}
				chrome.storage.local.set({logedon: JSON.parse(decrypt((response.passfile), getEncryptKey(masterPassword))),
					plainemail: plainemail,
					encmail: encmail,	//rsa
					encpass: encpass,	//rsa
					password: masterPassword,
					signuppassword: signuppassword});
				chrome.browserAction.setIcon({path: {"38": "assets/pmon.png"}});
				document.forms[0].classList.add("displayornot");
				document.getElementById('logoutdiv').classList.remove("displayornot");
				document.getElementById('loginTitle').classList.add("displayornot");
				document.getElementById('tbmanagediv').classList.remove("displayornot");
			}
			else {
				document.getElementById("loginmsg").innerHTML = "<h3 style='color:red;'>failed - no such user or wrong password</h3>";
				setTimeout(function(){document.getElementById("loginmsg").innerHTML = ""}, 3000);
				console.log(response);
			}
		},
		error: function(xhr, desc, err) {
			console.log(xhr);
			console.log("Details: " + desc + "\nError: " + err);
			document.getElementById("loginmsg").innerHTML = "<h3 style='color:red;'>error connecting to server. server is down probably.</h3>";
			setTimeout(function(){document.getElementById("loginmsg").innerHTML = ""}, 3000);
		}
	});
}

//signup ajax
document.getElementById("signup").onclick = function() {
	if (!checkSignForm()) 
		return false; //do noting if invalid form
	var email = document.forms[1].email.value;
	var masterPassword = document.forms[1].password.value;
	console.log("signing email = " + email);
	var hmacmail = getEmailHMACform(email);
	console.log("hmaced mail = " + hmacmail);
	var encryptedFile = JSON.stringify(encrypt(JSON.stringify({}), getEncryptKey(masterPassword)));
	var authFile = getHMAC(encryptedFile, getAuthenticationKey(masterPassword));
	$.ajax({
		type: "POST",
		url: HOST + "signup.php?",
		data: {'email': hmacmail,	// sign-up is with hmaced form mail and NOT rsa encrypted
		'password': getSignUpPassword(masterPassword),
		'file': encryptedFile,
		'authFile': authFile,
		'signup': "signmeup"},
		success: function(response) {
			console.log("server: " + response);
			setTimeout(function() {document.getElementById("resultmsg").innerHTML = ""}, 3000);
			if (response === "1") {
				document.getElementById("resultmsg").innerHTML = "<h3 style='color:red;'>email taken. try again</h3>";
				document.getElementById("resultmsg").scrollIntoView(true);
			}
			else if (response === "ok") {
				document.forms[1].reset();
				document.getElementById("passcore").innerHTML = "";
				document.getElementById("resultmsg").innerHTML = "<h3 style='color:blue;'>signup successful</h3>";
				document.getElementById("resultmsg").scrollIntoView(true);
			}
		},
		error: function(xhr, desc, err) {
			console.log(xhr);
			console.log("Details: " + desc + "\nError: " + err);
			alert("error server down");
		}
	});
}


// delete account in server ajax
document.getElementById("deleteAccount").onclick = function() {
	if(! confirm("delete this account?") ) return;
	chrome.storage.local.get(["plainemail", "signuppassword"], function(items) {
		$.ajax({
			type: "POST",
			url: HOST + "signup.php?",
			data: {'email': getEmailHMACform(items.plainemail),
					'password': items.signuppassword, 
					'delaccount': "delete me"
					},
			success: function(response) {
				console.log(response);
				logoutOrDeleteAccount();
				alert("pass file removed from server and all local data deleted");
				
			},
			error: function(xhr, desc, err) {
				console.log(xhr);
				console.log("Details: " + desc + "\nError: " + err);
				logoutOrDeleteAccount();
				alert("error server down. account can't be deleted");
			}
		});
	});
}

//logout and another sync with server although it is was kept synced, so just in case server was down and password stored locally
document.getElementById('logout').onclick = function() {
	chrome.storage.local.get(["logedon", "encmail", "password", "encpass"], function(items) {
		if(items.logedon) {
			var encryptedFile = JSON.stringify(encrypt(JSON.stringify(items.logedon), getEncryptKey(items.password)));
			var authFile = getHMAC(encryptedFile, getAuthenticationKey(items.password));
			$.ajax({
				type: "POST",
				url: HOST + "ser.php?",
				data: {'email': items.encmail,
				'password': items.encpass,
				'file': encryptedFile,
				'authFile': authFile},
				success: function(response) {
					if(response != "error" && response != "2") {
						console.log(response);
						logoutOrDeleteAccount();
						document.getElementById("loginmsg").innerHTML = "<h3 style='color:blue;'>pass file synced with server and all local data removed</h3>";
						setTimeout(function(){document.getElementById("loginmsg").innerHTML = ""}, 4000);
					}
					else
						alert("server parse error-please fix it and check if password saved");
				},
				error: function(xhr, desc, err) {
					console.log(xhr);
					console.log("Details: " + desc + "\nError: " + err);
					if(!confirm("server is down. password that stored locally while server is down will be lost. continue?"))
						return;
					logoutOrDeleteAccount();
				}
			});
		}
	});
}

function logoutOrDeleteAccount() {
	document.forms[0].classList.remove("displayornot");
	document.getElementById('logoutdiv').classList.add("displayornot");
	document.getElementById('tbmanagediv').classList.add("displayornot");
	document.getElementById('loginTitle').classList.remove("displayornot");
	chrome.browserAction.setIcon({path: {"38": "assets/pmoff.png"}});
	chrome.storage.local.remove(["logedon", "plainemail", "encmail", "password", "signuppassword"]);	
	$("#tbmanage").css({display: "none"});
}

//validation of form sign up
function checkSignForm() {
	if(document.forms[1].password.value == 0 || document.forms[1].email.value == 0) {
		alert("email or password must be filled");
		document.forms[1].password.focus();
		return false;
	}
	if(document.forms[1].password.value.length < 12) {
		alert("password length must be 12 or more");
		document.forms[1].password.focus();
		return false;
	}
	if(document.forms[1].password.value == document.forms[1].email.value) {
		alert("password cannot be equal to your email");
		document.forms[1].password.focus();
		return false;
	}
	if(document.forms[1].password.value != document.forms[1].pswrepeat.value) {
		alert("retyped password don't match");
		document.forms[1].password.focus();
		return false;
	}
	var x = document.forms[1].email.value;
	var atpos = x.indexOf("@");
	var dotpos = x.lastIndexOf(".");
	if (atpos < 1 || dotpos < atpos + 2 || dotpos + 2 >= x.length) {
		document.forms[1].email.focus();
		alert("please enter a valid format email");
		return false;
	}	
	return true; 
}

//credit mechanism for user typed passwords
function scorePassword() {
	var pass = document.forms[1].password.value;
	var score = 0;
	if (!pass || pass <= 0){
		document.getElementById("passcore").innerHTML = "";
		return
	}
	// award every unique letter until 3 repetitions
	var letters = new Object();
	for (var i = 0; i < pass.length; i++) {
		letters[pass[i]] = (letters[pass[i]] || 0) + 1;
		score += 3.0 / letters[pass[i]];
	}
	// bonus points for mixing it up
	var variations = {
		digits: /\d/.test(pass),
		lower: /[a-z]/.test(pass),
		upper: /[A-Z]/.test(pass),
		nonWords: /\W/.test(pass),
	}
	variationCount = 0;
	for (var check in variations) {
		variationCount += (variations[check] == true) ? 1 : 0;
	}
	score += (variationCount) * 10;
	score = parseInt(score);

	if (score > 70)
		document.getElementById("passcore").innerHTML = "strong";
	else if (score > 35)
		document.getElementById("passcore").innerHTML = "medium";
	else 
		document.getElementById("passcore").innerHTML = "weak";
}

//password reveal and management box
document.getElementById('manage').onclick = function() {
	chrome.storage.local.get(["logedon"], function(items) {
		$("#tbmanage").toggle("slow");
		if(Object.keys(items.logedon).length == 0) {
			var colheader = '<tr><th>no passwords stored</th></tr>\n';
			document.getElementById("tbmanage").innerHTML = colheader;
			return;
		}
		var colheader = '<tr><th>url</th><th>pass</th><th>action</th></tr>\n';
		document.getElementById("tbmanage").innerHTML = colheader;
		var table = document.getElementById("tbmanage").tBodies.item(0);
		var allPasswords = items.logedon;
		for (let key of Object.keys(items.logedon)) {
			var tr = document.createElement('tr'); 
			var td1 = document.createElement('td');
			var td2 = document.createElement('td');
			var button = document.createElement('button');
			button.innerHTML = 'delete';
			button.onclick = function() {
				//send message to update to server via backround page
				 delete allPasswords[key];	//creates a closure and saved environment 
				 chrome.storage.local.set({logedon: allPasswords}, function() {
				 	if(chrome.runtime.lastError) {
				 		console.log(chrome.runtime.lastError.message);
				 		return;
				 	}
				 });
				chrome.runtime.sendMessage({allpass: allPasswords}); //send all passwords to background page to ajax update the server
				document.getElementById('manage').click();
				return false;
			};
			var text1 = document.createTextNode(key.toString());
			var text2 = document.createTextNode(items.logedon[key].toString());
			td1.appendChild(text1);
			td2.appendChild(text2);
			tr.appendChild(td1);
			tr.appendChild(td2);
			tr.appendChild(button);
			table.appendChild(tr);
		}
	});
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById("firstpass").addEventListener("keyup", scorePassword);