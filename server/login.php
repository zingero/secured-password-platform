<?php	

$pk = file_get_contents('private.key');
$kh = openssl_pkey_get_private($pk,'ronorian');   // pass phrse for aes256 enc pem format file

function to_hex($data)
{
	return strtoupper(bin2hex($data));
}

if(isset($_POST['pk']) && !empty($_POST['pk'])) {   //public key request
	$details = openssl_pkey_get_details($kh);
	$p = array(to_hex($details['rsa']['n']), to_hex($details['rsa']['e']));
	echo json_encode($p);
}

if(isset($_POST['email']) && !empty($_POST['email'])) {
	include 'conhost.php';
	$con = mysqli_connect($host, $dbuser, $dbpass, $dbname);
	mysqli_query($con,"SET NAMES 'utf8'");

	if(!$con) {
		echo "2";
	}
	// sanitizing the data
	$email = $_POST['email'];
	$email = htmlspecialchars($email, ENT_QUOTES);	//prevent xss
	$email = pack('H*', $email);
	openssl_private_decrypt($email, $email, $kh);

	$password = $_POST['password'];
	$password = filter_var($password, FILTER_SANITIZE_MAGIC_QUOTES);
	$password = pack('H*', $password);
	openssl_private_decrypt($password, $password, $kh);

	$sql = "select * from users where email='$email'";
	$row =  mysqli_fetch_assoc(mysqli_query($con, $sql));
	if($row == 0) {
		// in case the mail or pass incorrect
		echo "no such user";
	}
	elseif($row['password'] !== hash('sha256', $password . $row['salt'])) {
		echo "wrong pass";
	}
	else {
		// get the passwordsfile
		$location = getcwd()."/userspass/".$email."/pass.txt";
		try {
			$passwordsfile = @file_get_contents($location);	///string of  sring json
			if ($passwordsfile === false) {
			echo "fnf";// Handle the error , fnf = file not found
			exit(1);
			}
		}catch (Exception $e) {
			echo "fnf";// Handle exception , fnf = file not found
			exit(1);
				}
		eval("\$passwordsfile = $passwordsfile;");
		
		echo json_encode(array(
			"passfile" => $passwordsfile,
			"authfile" => $row['auth']
			));
	}
}

?>