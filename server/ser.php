<?php

$pk = file_get_contents('private.key');
$kh = openssl_pkey_get_private($pk,'ronorian');   // pass phrse for aes256 enc pem format file

function to_hex($data)
{
	return strtoupper(bin2hex($data));
}

if (isset($_POST['email']) && !empty($_POST['email'])) {
	include 'conhost.php';
	$con = mysqli_connect($host, $dbuser, $dbpass, $dbname);
	mysqli_query($con,"SET NAMES 'utf8'");

	if (!$con) {
		echo "2";
	}
		// sanitizing the data
	$email = $_POST['email'];
	$email = htmlspecialchars($email, ENT_QUOTES);	//prevent xss
	$email = pack('H*', $email);
	openssl_private_decrypt($email, $email, $kh);   //email dectypted(rsa)

	$password = $_POST['password'];
	$password = filter_var($password, FILTER_SANITIZE_MAGIC_QUOTES);
	$password = pack('H*', $password);
	openssl_private_decrypt($password, $password, $kh);   //password dectypted(rsa)
	
	$auth = $_POST['authFile'];
	$sql = "select * from users where email='$email'";
	$row = mysqli_fetch_assoc(mysqli_query($con, $sql));
	if ($row == 0) {
	// in case the mail or pass incorrect
		echo "no such user";
	}	
	elseif($row['password'] !== hash('sha256',  $password . $row['salt'])){
		echo "wrong pass";
	}
	else {
		$sql = "UPDATE users SET auth='$auth' WHERE email='$email'" ;
		mysqli_query($con, $sql);
		$fileloc = getcwd()."/userspass/".$email."/pass.txt";
		chmod($fileloc, 0755); //Change the file permissions if allowed
		unlink($fileloc); //remove the file
		$myfile = fopen($fileloc, "w"); //create to passfile
		
		$encfile = $_POST['file'];
		$encfile = htmlspecialchars($encfile, ENT_QUOTES);	//prevent xss
		fwrite($myfile,$encfile);
		echo "server updated password and auth file success";
	}
}
else
	echo "error";
?>