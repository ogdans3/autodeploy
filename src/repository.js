const path = require("path");
const util = require("./util.js");
const uuidv4 = require('uuid/v4');
const { exec, spawn } = require('child_process');

const Log = require("./logs.js").Log;

class Repository {
	constructor(name, url, localDirectory, deployCommands, teardownCommands) {
		console.log(name, url, localDirectory)

		if(localDirectory === null || localDirectory === undefined || localDirectory === "") {
			localDirectory = path.join(__dirname, "..", "git");
			util.makeDir(localDirectory);
			localDirectory = path.join(localDirectory, name);
			//TODO: Should be removed 
			localDirectory = localDirectory.replace(/\\/g, "/");
		}
		
		url = Repository.handleGitUrl(url);
		this.userDefined = {
			localDirectory: localDirectory,
			name: name,
			url: url
		};
		this.id = uuidv4();
		this.commands = {deploy: deployCommands, teardown: teardownCommands};

		this._isExtracted = false;
		this.pid = null;
		new Log(this, "Repository created", "Repository was created on the server.", "The repository will be downloaded and relevant information will be extracted after the first merge with master.");
	}
	
	extract(json) {
		let repo = json.repository;

		this.serviceId = repo.id;
		this.name = repo.name;
		this.full_name = repo.full_name;
		this.sshUrl = repo.ssh_url;
		this.url = repo.url;

		this.fullJson = json;
		this._isExtracted = true;
	}

	/*
	This function returns a identifier for the repository which can be inserted in a hashmap. It may be constructred from any information given by the git webhooks
	The identifier is guaranteed to be unique across all supported services
	*/
	static getIdentifier(json) {
		let repo = json.repository;
		return repo.url;
	}

	static handleGitUrl(url) {
		if(url.indexOf(".git") !== url.length - ".git".length) {
			url += ".git";
		}
		if(url.indexOf("https") !== 0) {
			url = url.replace("http://", "https://");
		}
		return url;
	}

	get directory() {
		return this.userDefined.localDirectory;
	}

	get displayName() {
		return this.userDefined.name ? this.userDefined.name : this.name;
	}

	get isExtracted() {
		return this._isExtracted;
	}

	getIdentifier() {
		return this.id;
	}

	update(name, url, directory, deployCommands, teardownCommands) {
		this.userDefined.name = name;
		this.userDefined.url = url;

		let oldDirectory = this.directory;
		this.userDefined.localDirectory = directory;
		if(oldDirectory !== this.directory) {
			//TODO: Should we clone the repo again and delete the old one?
		}
		this.commands = {deploy: deployCommands, teardown: teardownCommands};
	}

	//TODO: Add event system
	cloneFinished() {
		this.teardown();
		this.deploy();
	}

	//TODO: Add event system
	pullFinished() {
		this.teardown();
		this.deploy();
	}

	teardown() {
		let self = this;
		let command = "";

		let teardown = this.commands.teardown;
		if(teardown === null || teardown === undefined || teardown === "") {
			if(this.pid === null) {
				new Log(self, "Teardown", "No service PID to terminate");
				return;
			}
			process.kill(-this.pid);
			return;
			teardown = "kill -9 " + this.pid;
		}
		command += teardown;

		let execOpt = {cwd: this.directory};
		if(util.isWin) {
			execOpt.shell = "C:\\Program Files\\Git\\git-bash.exe";
		}
		exec(command, execOpt, (err, stdout, stderr) => {
		  if (err) {
		  	new Log(self, "Teardown", "Node could not execute the command", err);
		    return;
		  }
		  new Log(self, "Teardown", "Command executed without error", stdout, stderr);
		});
	
	}

	deploy() {
		let self = this;
		let command = "";
		command += this.commands.deploy;

		let spawnOpt = {cwd: this.directory, detached: true};
		if(util.isWin) {
			//spawnOpt.shell = "C:\\Program Files\\Git\\git-bash.exe";
			command = command.replace("npm", "npm.cmd");
		}
		
		console.log("Commands: ", command);
		let args = command.split(" ");
		let child = spawn(args[0], args.slice(1), spawnOpt)
		let pid = child.pid;
		this.pid = pid;
		this.childProcess = child;
		new Log(self, "Deploy", "Spawned process with PID: " + pid);

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
			new Log(self, "Process exited", "Exit code: " + exitCode, stdout, stderr);
			console.log("Child exited with code: " + exitCode);
		});
		/* (err, stdout, stderr) => {
		  if (err) {
		  	new Log(self, "Build and Deploy", "Node could not execute the command", err);
		    return;
		  }
		  new Log(self, "Build and Deploy", "Command executed without error", stdout, stderr);
		});*/
	}

	toJSON() {
		let obj = {};
		obj.id = this.id;
		obj.serviceId = this.serviceId;
		obj.name = this.name;
		obj.url = this.userDefined.url;
		obj.serviceUrl = this.url;
		obj.userDefined = this.userDefined;
		obj.displayName = this.displayName;
		obj.isExtracted = this.isExtracted;
		obj.identifier = this.getIdentifier;
		obj.directory = this.directory;
		obj.editUrl = "/repo/edit/" + this.getIdentifier();
		obj.commands = this.commands;
		return obj;
	}
}

module.exports = Repository;

