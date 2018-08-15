const path = require("path");
const util = require("./util.js");

class Repository {
	constructor(name, url, localDirectory) {
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

		this._isExtracted = false;
	}
	
	extract(json) {
		let repo = json.repository;

		this.id = repo.id;
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
		return this.userDefined.url ? this.userDefined.url : this.url;
	}
}

module.exports = Repository;

