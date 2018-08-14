const { exec } = require('child_process');
const path = require("path");

module.exports = {};
module.exports.FOLDER = path.join(__dirname, "..", "./ssh_keys/");

let generate = function() {

	//ssh-keygen -t rsa -b 4096 -f ./ssh_keys/key_1 -N ""
	let file = path.join(module.exports.FOLDER, "key_1");
	file = file.replace(/\\/g, "/");

	let command = "ssh-keygen -t rsa -b 4096 -f " + file + " -N ''";
	exec(command, (err, stdout, stderr) => {
	  if (err) {
	  	console.error("Node could not execute the command", err);
	    return;
	  }

	  // the *entire* stdout and stderr (buffered)
	  console.log(`stdout: ${stdout}`);
	  console.log(`stderr: ${stderr}`);
	});

}

module.exports.generate = generate;

