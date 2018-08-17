logs = [];

class Log {
	constructor(repository, logName, ...text) {
		this.repository = repository;
		this.logName = logName;
		this.text = text;
		logs.push(this);
		console.log(this.toJSON());
	}

	toJSON() {
		let obj = {};
		obj.repository = this.repository.toJSON();
		obj.logName = this.logName;
		obj.text = this.text;
		return obj;
	}
}

module.exports.Log = Log;
module.exports.logs = logs;