const fs = require("fs");
const { exec, spawn } = require('child_process');
const Log = require("./logs.js").Log;

module.exports.makeDir = (dir) => {
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir);
	}
}

module.exports.spawn = (repo, logName, command, args, options) => {
	return new Promise((fulfill, reject) => {
		console.log("SPAWN PROCESS");
		let child = spawn(command, args, options)
		let pid = child.pid;

		repo.pid = pid;
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

