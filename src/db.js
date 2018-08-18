const Datastore = require('nedb');

let dbs = {};
module.exports.dbs = dbs;
module.exports.init = () => {
	dbs.users = new Datastore({ filename: "./dbs/users", autoload: true });
	dbs.repositories = new Datastore({ filename: "./dbs/repositories", autoload: true });
	dbs.logs = new Datastore({ filename: "./dbs/logs", autoload: true });
}

