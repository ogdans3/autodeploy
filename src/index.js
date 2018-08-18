const express = require("express");
const app = express();
const dot = require("express-dot-engine");

const cookieParser = require('cookie-parser');
const bodyParser = require("body-parser");
const session      = require('express-session');
const passport = require('passport');
const bcrypt   = require('bcrypt-nodejs');


const fs = require("fs");
const path = require("path");

require("./db.js").init();
const sshKeyGen = require("./sshKeyGen.js");
const git = require("./git.js");
const util = require("./util.js");
const logs = require("./logs.js");

sshKeyGen.generate();

let port = 3000;

// (optional) set globals any thing you want to be exposed by this in {{= }} and in def {{# }}
app.set("views", path.join(__dirname, "frontend"));
app.set("view engine", "dot");
app.engine('.dot', dot.__express);

app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(session({ secret: util.getSecret() })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

let latestMessage = "No message received yet";

let Repository = require("./repository.js");

app.get("/login", (req, res) => {
	res.render("login.dot");
})
app.get("/signup", (req, res) => {
	let keyObj = util.generateSignUpKey();
	console.log("Signup Key: ", keyObj.key, "\tvalid for " + keyObj.duration + " seconds");
	res.render("signup.dot");
})
app.get("/logout", (req, res) => {
	req.logout();
	res.redirect("/");
})

require("./signup.js")(passport);
require("./login.js")(passport);
// process the signup form
app.post('/signup', passport.authenticate('local-signup', {
    successRedirect : '/', // redirect to the secure profile section
    failureRedirect : '/signup', // redirect back to the signup page if there is an error
}));
app.post('/login', passport.authenticate('local-login', {
    successRedirect : '/', // redirect to the secure profile section
    failureRedirect : '/login', // redirect back to the signup page if there is an error
}));

let isLoggedIn = (req, res, next) => {
	if(req.isAuthenticated())
		return next();
	res.redirect("/");
}




app.get("/new", isLoggedIn, (req, res) => {
	res.sendFile(path.join(__dirname, "frontend", "new.html"));
})

app.get("/list", isLoggedIn, (req, res) => {
	Repository.list()
		.then(repositories => {
			let repos = repositories.map(r => r.toJSON());
			res.render("list.dot", {repositories: repos});
		})
		.catch(err => {
			console.error("Unable to list repositories", err);
		})
})

app.get("/repo/edit/:id", isLoggedIn, (req, res) => {
	let id = req.params.id;
	Repository.findById(id)
		.then((repo) => {
			res.render("edit.dot", {repository: repo.toJSON()});
		})
		.catch((err) => {
			new Log(null, "Unable to find repository with id: " + id);
			res.redirect("/list");
		})
})

app.post("/new", isLoggedIn, (req, res) => {
	let json = req.body;

	let name = json.name;
	let url = json.url;
	let directory = json.directory;
	let deployCommands = json.deployCommands;
	let teardownCommands = json.teardownCommands;
	repo = new Repository(name, url, directory, deployCommands, teardownCommands);
	repo.save()
		.then(() => {
			new logs.Log(repo, "Repository created", "Repository was created on the server.", "The repository will be downloaded and relevant information will be extracted after the first merge with master.");
		}).catch((err) => {
			new logs.Log(null, "Unable to save repository", err);
		});
	res.redirect("/");
})

app.post("/save/:id", isLoggedIn, (req, res) => {
	let id = req.params.id;
	let json = req.body;

	let name = json.name;
	let url = json.url;
	let directory = json.directory;
	let deployCommands = json.deployCommands;
	let teardownCommands = json.teardownCommands;

	Repository.findById(id)
		.then((repo) => {
			repo.update(name, url, directory, deployCommands, teardownCommands);
			res.send("Saved");
		})
		.catch((err) => {
			new Log(null, "Unable to find repository with id: " + id);
			res.redirect("/list");
		})
})

app.post("/receive", function(req, res){
	let json = req.body;
	res.send();

	let url = json.repository.url;
	url = Repository.handleGitUrl(url);
	Repository.findOne({url: url})
		.then((repo) => {
			if(repo === null || repo === undefined) {
				console.warn("Warning: Repository has not been created. We are ignoring the webhook intill a user creates the repository at the /new endpoint.")
				return;
			}else {
				console.log("Webhook for " + repo.displayName + " received");
			}

			if(!repo.isExtracted) {
				repo.extract(json);
				repo.saveUpdate();
			}

			let pusher = json.pusher;
			//TODO: Add proper casting to webhook classes! and use instanceof
			//If there exists a pusher object in the json, we assume that it is a pull request
			if(pusher !== null && pusher !== undefined) {
				//TODO: Get the repository based on the information given in the json
				repositoryUpdate(repo);
			}
		})
		.catch((err) => {
			console.error("Error happened: ", err);
			res.redirect("/list");
		})
});

function repositoryUpdate(repo) {
	let repoDir = repo.directory;

	if (!fs.existsSync(repoDir)){
		git.clone(repo);
	}else {
		git.pull(repo);
	}
}

app.get("/logs", isLoggedIn, function(req, res) {
	logs.getLogs()
		.then((logs) => {
			res.render("log.dot", {logs: logs});
		})
		.catch((err) => {
			let logReports = [];
			logReports.push(new logs.Log(null, "Unable to get logs", err).toJSON());
			res.render("log.dot", {logs: logReports});
		})
})

app.get("/key/:name", isLoggedIn, function(req, res) {
	let name = req.params.name;
	//TODO: Fix cases such as "key_1.pub.pub"
	if(name.indexOf(".pub") != name.length - ".pub".length) {
		name = name + ".pub";
	}
	let file = path.join(sshKeyGen.FOLDER, name);
	file = file.replace(/\\/g, "/");
	fs.readFile(file, "utf8", function(err, contents) {
		if(err) {
			res.status(400).send("Bad Request. Not able to read file");
		}
		res.send(contents);
	});
})

app.get("/key", isLoggedIn, function(req, res) {
	fs.readdir(sshKeyGen.FOLDER, (err, files) => {
		if(err) {
			console.log("Err: ", err)
		}
		res.send(files);
	})
})

app.get("/", (req, res) => {
	res.render("links.dot");
})

app.listen(port, () => {
	console.log("AutoDeploy server listening on port: " + port);
});
