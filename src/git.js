const path = require("path");
const { exec } = require('child_process');

const sshKeyGen = require("./sshKeyGen.js");
const util = require("./util.js");
const Log = require("./logs.js").Log;

const isWin = util.isWin;

//Git does not allow you to set -i option when cloning or pulling. To circumvent this you call this function and
//append the normal git command to the returned string.
function getSSHProxyCommand(privateKeyFile) {
	privateKeyFile = privateKeyFile.replace(/\\/g, "/");
	//TODO: Fix some proper authentication here. Ignoring and adding the host is not very secure. Potential Man in the middle 
	return 'GIT_SSH_COMMAND="ssh -i ' + privateKeyFile + ' -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ' + ' -F /dev/null" ';
}

function pull(repo) {
	let repoDir = repo.directory;
	let sshUrl = repo.sshUrl;

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
			new Log(repo, "Pull", "Node could not execute the command", err);
			return;
		}

		// the *entire* stdout and stderr (buffered)
		console.log(`stdout: ${stdout}`);
		console.log(`stderr: ${stderr}`);
		new Log(repo, "Pull", "Command executed without error", stdout, stderr);

		repo.pullFinished();
	});
}

function clone(repo) {
	let repoDir = repo.directory;
	let sshUrl = repo.sshUrl;

	console.log("Clone repo, directory: " + repoDir + ", sshUrl: " + sshUrl);
	let ssh = getSSHProxyCommand(path.join(sshKeyGen.FOLDER, "/key_1"));
	let command = ssh + "git clone " + sshUrl + " " + repoDir;
	if(isWin) {
		command = "\"C:\\Program Files\\Git\\git-bash.exe\" -c " + "'" + command + "'";
	}
	console.log("command: ", command);
	exec(command, (err, stdout, stderr) => {
		if (err) {
			console.error("Node could not execute the command", err);
			new Log(repo, "Clone", "Node could not execute the command", err);
			return;
		}

	  // the *entire* stdout and stderr (buffered)
	  console.log("Stdout: ", stdout);
	  console.log("Stdout: ", stderr);

	  new Log(repo, "Clone", "Command executed without error", stdout, stderr);
	  repo.cloneFinished();
	});
}

module.exports = {
	clone: clone,
	pull: pull
}