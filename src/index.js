const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const dot = require("express-dot-engine");

const fs = require("fs");
const path = require("path");

const sshKeyGen = require("./sshKeyGen.js");
const git = require("./git.js");
const logs = require("./logs.js");
sshKeyGen.generate();

let port = 3000;

// (optional) set globals any thing you want to be exposed by this in {{= }} and in def {{# }}
app.set("views", path.join(__dirname, "frontend"));
app.set("view engine", "dot");
app.engine('.dot', dot.__express);

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

app.get("/list", (req, res) => {
	let repos = Object.keys(repositories).map(r => repositories[r].toJSON())
	res.render("list.dot", {repositories: repos});
})

app.get("/repo/edit/:id", (req, res) => {
	let id = req.params.id;
	let repo = repositories[id].toJSON();
	console.log(repo);
	res.render("edit.dot", {repository: repo});
})

app.post("/new", (req, res) => {
	let json = req.body;
	console.log(json)

	let name = json.name;
	let url = json.url;
	let directory = json.directory;
	let deployCommands = json.deployCommands;
	let teardownCommands = json.teardownCommands;
	repo = new Repository(name, url, directory, deployCommands, teardownCommands);
	repositories[repo.getIdentifier()] = repo;

	res.send("Registered: " + name + ", " + url + ", " + directory);
})

app.post("/save/:id", (req, res) => {
	let id = req.params.id;
	let json = req.body;

	let name = json.name;
	let url = json.url;
	let directory = json.directory;
	let deployCommands = json.deployCommands;
	let teardownCommands = json.teardownCommands;

	let repo = repositories[id];
	repo.update(name, url, directory, deployCommands, teardownCommands);
	res.send("Saved");
})

app.post("/receive", function(req, res){
	let json = req.body;
	console.log(req.body);      // your JSON
	res.send();

	let url = json.repository.url;
	url = Repository.handleGitUrl(url);
	let repo;
	for(var i = 0; i < Object.keys(repositories).length; i++) {
		let key = Object.keys(repositories)[i];
		let r = repositories[key];
		if(r.userDefined.url === url) {
			repo = r;
		}
	}

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

app.get("/logs", function(req, res) {
	let jsonLogs = logs.logs.map(log => log.toJSON());
	console.log(jsonLogs);
	res.render("log.dot", {logs: jsonLogs.reverse()});
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
