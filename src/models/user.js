let users = {};
const bcrypt   = require('bcrypt-nodejs');
const uuidv4 = require('uuid/v4');

class User {
	constructor(username, passwordHash) {
		this.id = uuidv4();
		this.username = username;
		this.passwordHash = passwordHash;
	}

	validPassword(password) {
    	return bcrypt.compareSync(password, this.passwordHash);
	}

	async save() {
		console.log("Saving user");
		users[this.id] = this;
	}

	static generateHash(password){
		return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
	}

	static async findById(id) {
		return users[id];
	}

	static async findOneByUsername(username) {
		for(var i = 0; i < Object.keys(users).length; i++) {
			let id = Object.keys(users)[i];
			let user = users[id];

			if(user.username === username) {
				return user;
			}
		}
		return null;
	}

}

module.exports = User;