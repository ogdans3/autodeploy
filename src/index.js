const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const fs = require("fs");
const path = require("path");

const sshKeyGen = require("./sshKeyGen.js");
const git = require("./git.js");
sshKeyGen.generate();

let port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

let latestMessage = "No message received yet";

let Repository = require("./repository.js");
let repositories = {};


app.get("/new", (req, res) => {
	res.sendFile(path.join(__dirname, "frontend", "new.html"));
})

app.post("/new", (req, res) => {
	let json = req.body;
	console.log(json)

	let name = json.name;
	let url = json.url;
	let directory = json.directory;
	repo = new Repository(name, url, directory);
	repositories[repo.getIdentifier()] = repo;

	res.send("Registered: " + name + ", " + url + ", " + directory);
})

app.post("/receive", function(req, res){
	let json = req.body;
	console.log(req.body);      // your JSON
	latestMessage = json;
	res.send();

	let url = json.repository.url;
	url = Repository.handleGitUrl(url);
	let repo = repositories[url];

	if(repo === null || repo === undefined) {
		console.warn("Warning: Repository has not been created. We are ignoring the webhook intill a user creates the repository at the /new endpoint.")
		return;
	}else {
		console.log("Webhook for " + repo.displayName + " received");
	}

	if(!repo.isExtracted) {
		repo.extract(json);
	}

	console.log(repo, repo.userDefined, repo.directory);

	let pusher = json.pusher;
	console.log("Pusher: ", pusher);
	//TODO: Add proper casting to webhook classes! and use instanceof
	//If there exists a pusher object in the json, we assume that it is a pull request
	if(pusher !== null && pusher !== undefined) {
		//TODO: Get the repository based on the information given in the json
		repositoryUpdate(repo);
	}
});

function repositoryUpdate(repo) {
	let repoDir = repo.directory;

	if (!fs.existsSync(repoDir)){
		git.clone(repo);
	}else {
		git.pull(repo);
	}
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
