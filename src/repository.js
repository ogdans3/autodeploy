const path = require("path");
const util = require("./util.js");
const uuidv4 = require('uuid/v4');
const { exec, spawn } = require('child_process');
const kill = require('tree-kill');

const Log = require("./logs.js").Log;
const LogElement = require("./models/LogElement.js");
const db = require("./db.js").dbs.repositories;

class Repository extends LogElement {
	constructor(name, url, localDirectory, deployCommands, teardownCommands) {
		super();
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

	set(key, value) {
		let oldValue = this[key];
		if(oldValue !== undefined) {
			this[key] = value;
			//Reflect the change in the database
			this.saveUpdate();
		}
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

	save() {
		let self = this;
		return new Promise((fulfill, reject) => {
			db.insert(self.toJSON(), function (err, newDoc) {
				if(err) {
					reject();
					return;
				}
				fulfill();
			});
		})
	}

	//TODO: Add event system
	async cloneFinished() {
		await this.teardown();
		await this.deploy();
	}

	//TODO: Add event system
	async pullFinished() {
		await this.teardown();
		await this.deploy();
	}

	teardown() {
		let self = this;
		return new Promise((fulfill, reject) => {
			let command = "";

			let teardown = self.commands.teardown;
			if(teardown === null || teardown === undefined || teardown === "") {
				if(self.pid === null) {
					new Log(self, "Teardown", "No service PID to terminate");
					fulfill();
					return;
				}
				kill(self.pid, "SIGKILL", (err) => {
					if(err) {
						//Error code 128 means the process id does not exist any more and the process is therefore terminated
						if(err.code === 128) {
							new Log(self, "Teardown", "Service PID does not exist anymore, service is assumed shut down");
							fulfill();
						}else {
							new Log(self, "Teardown", "Failed to terminate service", err);
							reject();
							return;
						}
					}
					new Log(self, "Teardown", "Service terminated");
					fulfill();
				});
				return;
			}
			command += teardown;

			let execOpt = {cwd: self.directory};
			if(util.isWin) {
				execOpt.shell = "C:\\Program Files\\Git\\git-bash.exe";
			}
			exec(command, execOpt, (err, stdout, stderr) => {
				if (err) {
					new Log(self, "Teardown", "Node could not execute the command", err);
					reject();
					return;
				}
				new Log(self, "Teardown", "Command executed without error", stdout, stderr);
				fulfill();
			});


		})
	}

	async deploy() {
		console.log("DEPLOY. Commands: " + this.commands.deploy);
		let self = this;
		let commands = "";
		commands += this.commands.deploy;

		let spawnOpt = {cwd: this.directory};
		if(util.isWin) {
			//spawnOpt.shell = "C:\\Program Files\\Git\\git-bash.exe";
			commands = commands.replace(/npm/g, "npm.cmd");
		}

		commands = commands.split("&&");
		for(let i = 0; i < commands.length; i++) {
			let c = commands[i];
			c = c.trim().split(" ");
			console.log("Command: ", c);
			await util.spawn(self, "Deploy", c[0], c.slice(1), spawnOpt);
		}
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
		obj.fullJson = this.fullJson;
		obj.pid = this.pid;
		return obj;
	}

	saveUpdate() {
		let self = this;
		return new Promise((fulfill, reject) => {
			db.update({id: self.id}, self.toJSON(), function(err, numReplaced) {
				if(err) {
					new Log(self, "Unable to update repository in database", err);
					reject();
					return;
				}
				fulfill();
			})
		})
	}

	static fromJSON(json) {
		let displayName = json.displayName;
		let url = json.url;
		let localDirectory = json.directory;
		let deployCommands = json.commands.deploy || "";
		let teardownCommands = json.commands.teardown || "";
		let repo = new Repository(displayName, url, localDirectory, deployCommands, teardownCommands);
		repo.id = json.id;
		repo.pid = json.pid;
		if(json.isExtracted) {
			repo.extract(json.fullJson);
		}
		return repo;
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

	static findById(id) {
		return new Promise((fulfill, reject) => {
			db.findOne({"id": id}, function (err, doc) {
				console.log(err, doc);
				if(err) {
					reject(err);
					return;
				}
				if(doc) {
					fulfill(Repository.fromJSON(doc));
				}else {
					fulfill();
				}
			});
		})
	}

	static findOne(obj) {
		return new Promise((fulfill, reject) => {
			db.findOne(obj, function (err, doc) {
				if(err) {
					reject(err);
					return;
				}
				if(doc) {
					fulfill(Repository.fromJSON(doc));
				}else {
					fulfill();
				}
			});
		})
	}

	static list(obj, skip, limit) {
		skip = skip || 0;
		//TODO: No limit?
		limit = limit || 100;

		return new Promise((fulfill, reject) => {
			db.find()
				.sort({name: 1})
				.skip(skip)
				.limit(limit)
				.exec(function (err, docs) {
					if(err) {
						reject(err);
						return;
					}
					if(docs.length !== 0) {
						let repos = docs.map(doc => Repository.fromJSON(doc));
						fulfill(repos);
					}else {
						fulfill([]);
					}
				});
		})
	}
}

module.exports = Repository;

