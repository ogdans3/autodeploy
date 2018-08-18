const fs = require("fs");
const { exec, spawn } = require('child_process');
const Log = require("./logs.js").Log;
const randomstring = require("randomstring");
const crypto = require('crypto');

const db = require("./db.js").dbs.secret;

let secret = null;

module.exports.makeDir = (dir) => {
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir);
	}
}

module.exports.getSecret = () => {
	//If the secret does not exist, create a random one
	//TODO: Also add configuring options so that the user can set this secret to something else if they wish
	if(secret) 
		return secret;
	secret = crypto.randomBytes(64).toString('hex');
	return secret;
}

let signUpKeys = [];
module.exports.isValidSignUpKey= (key) => {
	if(signUpKeys.indexOf(key) !== -1)
		return true;
	return false;
}

module.exports.generateSignUpKey = (duration) => {
	let key = randomstring.generate({
		length: 8,
		charset: "alphabetic"
	});
	signUpKeys.push(key);
	duration = duration || 60 * 5;
	//Remove the key after duration seconds
	setTimeout((key) => {
		var indexToRemove = signUpKeys.indexOf(key);
		if(indexToRemove === -1) {
			return;
		}

		signUpKeys.splice(indexToRemove, 1);
	}, duration);
	return {key: key, duration: duration};
}

module.exports.spawn = (repo, logName, command, args, options) => {
	return new Promise((fulfill, reject) => {
		console.log("SPAWN PROCESS");
		let child = spawn(command, args, options)
		let pid = child.pid;

		repo.set("pid", pid);
		repo.childProcess = child;
		new Log(repo, logName, "Spawned process with PID: " + pid);

		let stdout = [];
		let stderr = [];
		child.stderr.on('data', function (data) {
			stderr.push(data.toString());
			console.error("STDERR:", data.toString());
		});
		child.stdout.on('data', function (data) {
			stdout.push(data.toString());
			console.log("STDOUT:", data.toString());
		});
		child.on('exit', function (exitCode) {
			new Log(repo, "Process exited", "Command:" + command, "Exit code: " + exitCode, stdout, stderr);
			console.log("Child exited with code: " + exitCode, stdout, stderr);
			fulfill();
		});
	});
}

module.exports.isWin = process.platform === "win32";

