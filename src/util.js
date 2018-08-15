const fs = require("fs");

module.exports.makeDir = (dir) => {
	if (!fs.existsSync(dir)){
    	fs.mkdirSync(dir);
	}
}

module.exports.isWin = process.platform === "win32";

