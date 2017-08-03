<?php

if (isset($_POST['email']) && !empty($_POST['email'])) {
	include 'conhost.php';
	$con = mysqli_connect($host, $dbuser, $dbpass, $dbname);
	mysqli_query($con,"SET NAMES 'utf8'");

	if(!$con) {
		echo "2";  //erרor code 2: unable to connect database
		exit(1);
	}
	
	if (isset($_POST['signup']) && !empty($_POST['signup'])) { 
		// sanitizing the data
		$email = $_POST['email'];
		$email = htmlspecialchars($email, ENT_QUOTES);	//prevent xss
		$password = $_POST['password'];
		$password = filter_var($password, FILTER_SANITIZE_STRING);
		$password = filter_var($password, FILTER_SANITIZE_MAGIC_QUOTES);
		$salt = uniqid();
		$password = hash('sha256', $password . $salt);	//salted pass
		$auth = $_POST['authFile'];
		$sql = "select * from users where email='$email'";
		$row = mysqli_fetch_array(mysqli_query($con, $sql));
		if ($row) {
			// in case the mail is already taken
			echo "1"; // email taken
		}
		else {
			// insert into the DB
			$new_folder = getcwd()."/userspass/".$email."/";
			mkdir ($new_folder, 0777, true);
			$myfile = fopen($new_folder."pass.txt", "w"); //create to passfile
			$newfile = $_POST['file'];
			fwrite($myfile, $newfile);  //add file to firt time
			$insert_sql = "INSERT INTO users (email, password, salt , auth) VALUES ('$email','$password', '$salt' , '$auth')";   //php salt and hasehd random
			$ans = mysqli_query($con,"$insert_sql");
			mysqli_close($con); // Closing Connection	
			echo "ok"; //sucssesful signup  
		}
	}
	elseif (isset($_POST['delaccount']) && !empty($_POST['delaccount'])) { 
		$email = $_POST['email'];
		$email = htmlspecialchars($email, ENT_QUOTES);	//prevent xss
		$password = $_POST['password'];
		$password = filter_var($password, FILTER_SANITIZE_STRING);
		$password = filter_var($password, FILTER_SANITIZE_MAGIC_QUOTES);
	
		$sql = "select * from users where email='$email'";
		$row = mysqli_fetch_array(mysqli_query($con, $sql));
		if (!$row) {
			echo "wrong email"; 
		}
		elseif($row['password'] !== hash('sha256',  $password . $row['salt'])){
			echo "wrong pass";
		}
		else {
			$sql="DELETE FROM users WHERE email='$email'";
			mysqli_query($con,$sql);
			
			$fileloc = getcwd()."/userspass/".$email."/pass.txt";
			chmod($fileloc, 0755); //Change the file permissions if allowed
			unlink($fileloc); //remove the file
			rmdir(getcwd()."/userspass/".$email);
			
			echo "delete account successful";
		}	
		
	}
}

?>