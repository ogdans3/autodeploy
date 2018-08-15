const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const fs = require("fs");
const { exec } = require('child_process');
const path = require("path");

var isWin = process.platform === "win32";

const sshKeyGen = require("./sshKeyGen.js");
sshKeyGen.generate();

let port = 3000;

app.use(bodyParser.json());

let latestMessage = "No message received yet";

app.post("/receive", function(req, res){
	let json = req.body;
	console.log(req.body);      // your JSON
	latestMessage = json;
	res.send();

	let pusher = latestMessage.pusher;
	console.log("Pusher: ", pusher);
	//TODO: Add proper casting to webhook classes! and use instanceof
	//If there exists a pusher object in the json, we assume that it is a pull request
	if(pusher !== null && pusher !== undefined) {
		//TODO: Get the repository based on the information given in the json
		repositoryUpdate(json);
	}
});

function repositoryUpdate(json) {
	console.log("Update repository");
	let repo = json.repository;
	let repoName = repo.name;
	let sshUrl = repo.ssh_url;

	let dir = path.join(__dirname, "..", "git");
	dir = dir.replace(/\\/g, "/");
	console.log("Git dir: " + dir);

	if (!fs.existsSync(dir)){
    	fs.mkdirSync(dir);
	}

	let repoDir = path.join(__dirname, "..", "git", repoName);
	repoDir = repoDir.replace(/\\/g, "/");
	console.log("Repo dir: " + repoDir);
	if (!fs.existsSync(repoDir)){
		clone(sshUrl, repoDir);
	}else {
		pull(repoDir, sshUrl);
	}
}

//Git does not allow you to set -i option when cloning or pulling. To circumvent this you call this function and
//append the normal git command to the returned string.
function getSSHProxyCommand(privateKeyFile) {
	privateKeyFile = privateKeyFile.replace(/\\/g, "/");
	return 'GIT_SSH_COMMAND="ssh -i ' + privateKeyFile + "-o 'StrictHostKeyChecking no'" + ' -F /dev/null" ';
}

function pull(repoDir, sshUrl) {
	console.log("Pull repo, repoDir: " + repoDir + ", sshUrl: " + sshUrl);
	let ssh = getSSHProxyCommand(path.join(sshKeyGen.FOLDER, "/key_1"));
	//TODO: Replace ; with &&
	let command = "cd " + repoDir + "; " + ssh + "git pull " + sshUrl;
	if(isWin) {
		command = "\"C:\\Program Files\\Git\\git-bash.exe\" -c " + "'" + command + "'";
	}
	exec(command, (err, stdout, stderr) => {
	  if (err) {
	  	console.error("Node could not execute the command", err);
	    return;
	  }

	  // the *entire* stdout and stderr (buffered)
	  console.log(`stdout: ${stdout}`);
	  console.log(`stderr: ${stderr}`);
	});
}

function clone(sshUrl, directory) {
	console.log("Clone repo, directory: " + directory + ", sshUrl: " + sshUrl);
	let ssh = getSSHProxyCommand(path.join(sshKeyGen.FOLDER, "/key_1"));
	let command = ssh + "git clone " + sshUrl + " " + directory;
	if(isWin) {
		command = "\"C:\\Program Files\\Git\\git-bash.exe\" -c " + "'" + command + "'";
	}
	console.log("command: ", command);
	exec(command, (err, stdout, stderr) => {
	  if (err) {
	  	console.error("Node could not execute the command", err);
	    return;
	  }

	  // the *entire* stdout and stderr (buffered)
	  console.log("Stdout: ", stdout);
	  console.log("Stdout: ", stderr);
	});
}

app.get("/last", function(req, res) {
	res.send(latestMessage);
})

app.get("/key/:name", function(req, res) {
	let name = req.params.name;
	//TODO: Fix cases such as "key_1.pub.pub"
	if(name.indexOf(".pub") != name.length - ".pub".length) {
		name = name + ".pub";
	}
	let file = path.join(sshKeyGen.FOLDER, name);
	file = file.replace(/\\/g, "/");
	console.log(file)
	fs.readFile(file, "utf8", function(err, contents) {
		if(err) {
			res.status(400).send("Bad Request. Not able to read file");
		}
		res.send(contents);
	});
})

app.get("/key", function(req, res) {
	console.log("Get all keys");
	fs.readdir(sshKeyGen.FOLDER, (err, files) => {
		if(err) {
			console.log("Err: ", err)
		}
		console.log("Keys: ", files);
		res.send(files);
	})
})

app.listen(port, () => {
	console.log("AutoDeploy server listening on port: " + port);
});