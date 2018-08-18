const db = require("./db.js").dbs.logs;
const LogElement = require("./models/LogElement.js");

class Log {
	constructor(logElement, logName, ...text) {
		this.logElement = logElement instanceof LogElement? logElement.toJSON() : "";
		this.logName = logName;
		this.text = text || [];
		this.unixTimestamp = Math.floor(new Date() / 1000); //Generate unix time stamp
		this.save();
	}

	toJSON() {
		let obj = {};
		obj.logElement = this.logElement;
		obj.logName = this.logName;
		obj.text = this.text;
		obj.unixTimestamp = this.unixTimestamp;
		return obj;
	}

	save() {
		let self = this;
		return new Promise((fulfill, reject) => {
			db.insert(self.toJSON(), function(err, doc) {
				if(err) {
					reject(err);
					console.error("Unable to save log");
					return;
				}
				fulfill();
			});
		})
	}

	static fromJSON(json) {
		let logElement = json.logElement;
		let logName = json.logName;
		let text = json.text;
		let unixTimestamp = json.unixTimestamp;

		let log = new Log(logElement, logName, text);
		log.unixTimestamp = unixTimestamp;
		return log;
	}
}

let getLogs = (from, to) => {
	to = to || 20;
	from = from || 0;

	return new Promise((fulfill, reject) => {
		db 	.find({})
			.sort({unixTimestamp: -1})
			.skip(from)
			.limit(to)
			.exec((err, docs) => {
				if(err) {
					reject(err);
					return;
				}
				fulfill(docs);
			})
	})
}

if(db === null || db === undefined) {
	new Log(null, "Database not initialised before required!");
}

module.exports.Log = Log;
module.exports.getLogs = getLogs;