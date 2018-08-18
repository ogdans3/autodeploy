const bcrypt   = require('bcrypt-nodejs');
const uuidv4 = require('uuid/v4');
const Log = require("./../logs.js").Log;
const db = require("./../db.js").dbs.users;

class User {
	constructor(username, passwordHash) {
		this.id = uuidv4();
		this.username = username;
		this.passwordHash = passwordHash;
	}

	validPassword(password) {
    	return bcrypt.compareSync(password, this.passwordHash);
	}

	save() {
		let self = this;
		return new Promise((fulfill, reject) => {
			console.log("Saving user");
			db.insert(self.toJSON(), function (err, newDoc) {
				if(err) {
					new Log(null, "Unable to save user", err);
					reject();
					return;
				}
				new Log(null, "New user created with username: " + self.username, err);
				fulfill();
			});
		})
	}

	static generateHash(password){
		return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
	}

	static findById(id) {
		return new Promise((fulfill, reject) => {
			db.findOne({"id": id}, function (err, doc) {
				if(err) {
					reject(err);
					return;
				}
				if(doc) {
					fulfill(User.fromJSON(doc));
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
					fulfill(User.fromJSON(doc));
				}else {
					fulfill();
				}
			});
		})
	}

	toJSON() {
		let obj = {};
		obj.username = this.username;
		obj.passwordHash = this.passwordHash;
		obj.id = this.id;
		return obj;
	}

	static fromJSON(json) {
		let username = json.username;
		let passwordHash = json.passwordHash;
		let id = json.id;

		let user = new User(username, passwordHash);
		user.id = id;
		return user;
	}

}

module.exports = User;