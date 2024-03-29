function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

//Import dependencies
import {
	AutojoinRoomsMixin,
	MatrixClient,
	SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import fs from "node:fs";
import yaml from "js-yaml";
import crypto from "node:crypto";

//Parse YAML configuration file
let loginFile = fs.readFileSync("./db/login.yaml", "utf8");
const loginParsed = yaml.load(loginFile);
const homeserver = loginParsed.homeserverUrl;
const addr = loginParsed.curlAddress;
const accessToken = loginParsed.loginToken;
let adminRoom = loginParsed.administrationRoom;
const prefix = loginParsed.prefix;
const authorizedUsers = loginParsed.authorizedUsers;
const dendriteyaml = loginParsed.dendriteYaml;
const deactivatedpfp = loginParsed.deactivatedPfp;
const deactivateddn = loginParsed.deactivatedDn;

//if the interface config does not supply a path
if (!dendriteyaml) {
	console.log(
		"No path to dendrite configuration file found, this is necessary for the interface to run.",
	);
	process.exit(1);
}

//read in the file
let dendriteyamlcfg = "";
try {
	dendriteyamlcfg = fs.readFileSync(dendriteyaml, "utf8");
} catch (e) {
	console.log(e);
	console.log(
		`Unable to read file ${dendriteyaml}, was the correct path provided?`,
	);
	process.exit(1);
}

//try to parce the file
let dendriteconfig = "";
try {
	dendriteconfig = yaml.load(dendriteyamlcfg);
} catch (e) {
	console.log(e);
	console.log(`Unable to parce file ${dendriteyaml}, is this a yaml file`);
	process.exit(1);
}

//an essential part of the dendrite configuration file
if (!dendriteconfig?.global) {
	console.log(
		"No global block found in the dendrite configuration file. Is this a dendrite configuration file?",
	);
	process.exit(1);
}
if (!dendriteconfig.client_api) {
	console.log(
		"No client_api block found in the dendrite configuration file. Is this a dendrite configuration file?",
	);
	process.exit(1);
}

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserver, accessToken, storage);

//preallocate variables so they have a global scope
let mxid;
let server;
let queuedConfirmation;

//for temporary passord generation
function generateSecureOneTimeCode(length) {
	return crypto.randomBytes(length).toString("base64");
}

//Start Client
client.start().then(async () => {
	console.log("Client started!");

	//get mxid
	mxid = await client.getUserId();
	server = mxid.split(":")[1];

	//create pl feild for each authorized user
	const authorizedPL = { [mxid]: 101 };
	for (const a of authorizedUsers) {
		authorizedPL[a] = 100;
	}

	//if the feild is empty then we should create a room
	if (!adminRoom) {
		adminRoom = await client.createRoom({
			initial_state: [
				{
					content: {
						join_rule: "invite",
					},
					state_key: "",
					type: "m.room.join_rules",
				},
				{
					content: {
						history_visibility: "joined",
					},
					state_key: "",
					type: "m.room.history_visibility",
				},
			],
			power_level_content_override: {
				ban: 50,
				events: {
					"m.room.avatar": 50,
					"m.room.canonical_alias": 50,
					"m.room.encryption": 100,
					"m.room.history_visibility": 100,
					"m.room.name": 50,
					"m.room.power_levels": 100,
					"m.room.server_acl": 100,
					"m.room.tombstone": 100,
				},
				events_default: 0,
				invite: 0,
				kick: 50,
				notifications: {
					room: 50,
				},
				redact: 50,
				state_default: 50,
				users: authorizedPL,
				users_default: 0,
			},
			invite: authorizedUsers,
			is_direct: false,
			name: "Administration Room",
		});

		//write new room id to the login file
		loginParsed["administration-room"] = adminRoom;
		loginFile = yaml.dump(loginParsed);
		fs.writeFile("./db/login.yaml", loginFile, () => {});
	}

	// to remotely monitor how often the bot restarts, to spot issues
	client
		.sendText(adminRoom, "Started.")

		//if there is no room to work in there is no reason for the bot to be online
		.catch(() => {
			console.log(
				"The bot is either not in the administration room, or does not have permission to send messages into it. Suggested remedy: empty `administration-room:` feild from login.yaml and let the bot create a new room.",
			);
			process.exit(1);
		});
});
/*
Makes an internal request to the global `homeserver` address following standard dendrite request.
*/

async function makeAdminReq(software, reqType, command, arg1, arg2, body) {
	//base url guaranteed to always be there
	//Dendrite only accepts requests from localhost
	let url = `${addr}/${software}/admin/${command}`;

	//if there is a first argument add it
	if (arg1) url += `/${arg1}`;

	//if there is a second argument add it
	if (arg2) url += `/${arg2}`;

	//if body is supplied, stringify it to send in http request
	let bodyStr = null;
	if (body) bodyStr = JSON.stringify(body);

	//response
	let r;

	try {
		//make the request and return whatever the promise resolves to
		const response = await fetch(url, {
			method: reqType,
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: bodyStr,
		});
		r = await response.text();

		//.catch
	} catch (e) {
		client.sendHtmlNotice(
			adminRoom,
			`❌ | could not make <code>${url}</code> request with error\n<pre><code>${e}</code></pre>`,
		);
	}

	//.then
	client.sendHtmlNotice(
		adminRoom,
		`Ran <code>${url}</code> with response <pre><code>${r}</code></pre>`,
	);
}

async function makeUserReq(reqType, command, arg1, arg2, userToken, body) {
	//base url guaranteed to always be there
	//Dendrite only accepts requests from localhost
	let url = `${addr}/_matrix/client/v3/${command}`;

	//if there is a first argument add it
	if (arg1) url += `/${arg1}`;

	//if there is a second argument add it
	if (arg2) url += `/${arg2}`;

	//if body is supplied, stringify it to send in http request
	let bodyStr = null;
	if (body) bodyStr = JSON.stringify(body);

	let response;
	try {
		//make the request and return whatever the promise resolves to
		response = await (
			await fetch(url, {
				method: reqType,
				headers: {
					Authorization: `Bearer ${userToken}`,
					"Content-Type": "application/json",
				},
				body: bodyStr,
			})
		).json();

		//.catch
	} catch (e) {
		client.sendHtmlNotice(
			adminRoom,
			`❌ | could not make <code>${url}</code> request with error\n<pre><code>${e}</code></pre>`,
		);
	}

	//.then
	client.sendHtmlNotice(
		adminRoom,
		`Ran <code>${url}</code> with response <pre><code>${JSON.stringify(
			response,
		)}</code></pre>`,
	);

	return response;
}

async function resetUserPwd(localpart, suppliedPwd, logout) {
	const userMxid = `@${localpart}:${server}`;

	const pwd = suppliedPwd || generateSecureOneTimeCode(35);

	makeAdminReq("_dendrite", "POST", "resetPassword", userMxid, null, {
		password: pwd,
		logout_devices: logout,
	});

	return pwd;
}

async function evacuateUser(mxid) {
	makeAdminReq("_dendrite", "POST", "evacuateUser", mxid);
}

async function purgeRoom(roomId) {
	makeAdminReq("_dendrite", "POST", "purgeRoom", roomId);
}

//run dendrite admin endpoint to evacuate all users from `roomId`
async function evacuateRoom(roomId, preserve) {
	makeAdminReq("_dendrite", "POST", "evacuateRoom", roomId).then((e) => {
		//if preserve flag not provided, proceed to purgeRoom
		if (!preserve) purgeRoom(roomId);
	});
}

//resolves roomAlias to roomId, and runs evacuateRoom(roomId)
function evacuateRoomAlias(roomAlias, preserve) {
	client
		.resolveRoom(roomAlias)
		.then((r) => evacuateRoom(r, preserve))
		.catch((e) =>
			client.sendHtmlNotice(
				adminRoom,
				`❌ | Ran into the following error resolving that roomID:\n<pre><code>${e}</code></pre>`,
			),
		);
}

//js rewrite of code found at https://matrix-org.github.io/synapse/latest/admin_api/register_api.html
function generate_mac(nonce, user, password) {
	const admin = false; // Hardcoded admin to be false
	const mac = crypto.createHmac(
		"sha1",
		dendriteconfig.client_api.registration_shared_secret,
	);

	mac.update(nonce);
	mac.update(Buffer.from([0]));
	mac.update(user);
	mac.update(Buffer.from([0]));
	mac.update(password);
	mac.update(Buffer.from([0]));
	mac.update(Buffer.from("notadmin"));

	return mac.digest("hex");
}

async function createAccount(username, suppliedPwd) {
	//get nonce
	const nonce = (
		await (
			await fetch(`${addr}/_synapse/admin/v1/register`, {
				method: "GET",
			})
		).json()
	).nonce;

	//if no password supplied, generate one
	const pwd = suppliedPwd || generateSecureOneTimeCode(35);

	//generate mac (see documentation)
	const mac = generate_mac(nonce, username, pwd);

	//https://matrix-org.github.io/synapse/latest/admin_api/register_api.html
	makeAdminReq("_synapse", "POST", "v1", "register", null, {
		nonce: nonce,
		username: username,
		displayname: username,
		password: pwd,
		admin: false,
		mac: mac,
	});

	return pwd;
}

//data structure to hold commands
const commandHandlers = new Map();

//if confirm command is ran, run the function queued.
commandHandlers.set("confirm", async () => {
	if (queuedConfirmation) queuedConfirmation();
});

//evacuate command
commandHandlers.set("evacuate", ({ contentByWords }) => {
	//required for mxid, roomid, and room aliases
	if (!contentByWords[1].includes(":") || !contentByWords[1].includes(".")) {
		//this command will only be runnable in the admin room so we can assume to send the error there
		client.sendHtmlNotice(
			adminRoom,
			`❌ | <code>${contentByWords[1]}</code> does not appear to be a valid user ID, room ID, or room alias.`,
		);

		//no need to proceed
		return;
	}

	//check for preservation flag
	const preserve =
		contentByWords[2] === "--preserve" || contentByWords[2] === "-p";

	//first character will tell us what type of id it is
	switch (contentByWords[1][0]) {
		//user MXID
		case "@":
			evacuateUser(contentByWords[1]);
			break;

		//roomID
		case "!":
			evacuateRoom(contentByWords[1], preserve);
			break;

		//room alias
		case "#":
			evacuateRoomAlias(contentByWords[1], preserve);
			break;

		//none of the above
		default:
			client.sendHtmlNotice(
				adminRoom,
				`❌ | <code>${contentByWords[1]}</code> does not appear to be a valid user ID, room ID, or room alias.`,
			);
			break;
	}
});

commandHandlers.set("newaccount", async ({ contentByWords, event }) => {
	//first argument provided
	let user = contentByWords[1];
	if (!user) {
		client.sendHtmlNotice(adminRoom, "❌ | no user indicated.");

		return;
	}

	//remove the @ no matter if its a mxid or localpart
	//user may mistakenly provide @localpart or localpart:server.tld and that is okay
	// .substring(1) just removes the first char
	if (user.startsWith("@")) user = user.substring(1);

	//decides if its a mxid or localpart
	if (user.includes(":")) {
		//if its not a local user we cant do anything
		if (!user.endsWith(`:${server}`)) {
			client.sendHtmlNotice(
				adminRoom,
				`❌ | <code>${contentByWords[1]}</code> does not appear to be a valid user ID.`,
			);

			return;
		}

		//we want only the localpart
		//while there are normal restrictions on user account chars, @ and : are the only characters that truly cannot be allowed
		//it is possible for admins to modify dendrite to remove those restrictions, and this interface need not restrict to that needlessly
		user = user.split(":")[0];
	}

	//second argument is password
	const passwd = contentByWords[2];

	const setpasswd = await createAccount(user, passwd);

	client.sendHtmlNotice(
		adminRoom,
		`(Attempted to) Created new account <code>${user}</code> with password <code>${setpasswd}</code>`,
	);
});

commandHandlers.set("passwd", async ({ contentByWords, event }) => {
	//first argument provided
	let user = contentByWords[1];
	if (!user) {
		client.sendHtmlNotice(adminRoom, "❌ | no user indicated.");

		return;
	}

	//remove the @ no matter if its a mxid or localpart
	//user may mistakenly provide @localpart or localpart:server.tld and that is okay
	// .substring(1) just removes the first char
	if (user.startsWith("@")) user = user.substring(1);

	//decides if its a mxid or localpart
	if (user.includes(":")) {
		//if its not a local user we cant do anything
		if (!user.endsWith(`:${server}`)) {
			client.sendHtmlNotice(
				adminRoom,
				`❌ | <code>${contentByWords[1]}</code> does not appear to be a valid user ID.`,
			);

			return;
		}

		//we want only the localpart
		//while there are normal restrictions on user account chars, @ and : are the only characters that truly cannot be allowed
		//it is possible for admins to modify dendrite to remove those restrictions, and this interface need not restrict to that needlessly
		user = user.split(":")[0];
	}

	//second argument is boolean of whether currently logged in devices should be logged out
	let logout;

	// `t` or `true` will result in a positive input
	if (contentByWords[2] === "true" || contentByWords[2] === "t") {
		logout = true;

		// `f` or `false` will result in a negative input
	} else if (!(contentByWords[2] === "false" || contentByWords[2] === "f")) {
		logout = false;

		//if its neither of the above we cannot proceed as we need to know that information
	} else {
		client.sendHtmlNotice(
			adminRoom,
			`❌ | <code>${contentByWords[2]}</code> not values <b>T</b>rue or <b>F</b>alse, unsure if logging out devices is desired.`,
		);

		return;
	}

	//third argument is password
	const passwd = contentByWords[3];

	const setpasswd = await resetUserPwd(user, passwd, logout);

	client.sendHtmlNotice(
		adminRoom,
		`(Attempted to) reset password of user <code>${user}</code> to <code>${setpasswd}</code>`,
	);
});

commandHandlers.set("deactivate", async ({ contentByWords, event }) => {
	//first argument provided
	let user = contentByWords[1];
	if (!user) {
		client.sendHtmlNotice(adminRoom, "❌ | no user indicated.");

		return;
	}

	//remove the @ no matter if its a mxid or localpart
	//user may mistakenly provide @localpart or localpart:server.tld and that is okay
	// .substring(1) just removes the first char
	if (user.startsWith("@")) user = user.substring(1);

	//decides if its a mxid or localpart
	if (user.includes(":")) {
		//if its not a local user we cant do anything
		if (!user.endsWith(`:${server}`)) {
			client.sendHtmlNotice(
				adminRoom,
				`❌ | <code>${contentByWords[1]}</code> does not appear to be a valid user ID.`,
			);

			return;
		}

		//we want only the localpart
		//while there are normal restrictions on user account chars, @ and : are the only characters that truly cannot be allowed
		//it is possible for admins to modify dendrite to remove those restrictions, and this interface need not restrict to that needlessly
		user = user.split(":")[0];
	}

	const userMxid = `@${user}:${server}`;

	//require confirmation as this is a permanent action
	client.sendHtmlNotice(
		adminRoom,
		`Please confirm your intention to deactivate <code>${userMxid}</code> by running <code>${prefix}confirm</code>. <span style="color:red;"><b>THIS IS A PERMANENT ACTION!!</b></span>`,
	);

	queuedConfirmation = async () => {
		queuedConfirmation = null;

		//reset the password as to lock out the user
		const newpwd = await resetUserPwd(user, null, true);

		//idk some race conditions, this makes it work more reliably so sure
		await delay(1000);

		//make login request
		const response = await makeUserReq("POST", "login", null, null, null, {
			type: "m.login.password",
			identifier: {
				type: "m.id.user",
				user: user,
			},
			password: newpwd,
		});

		const userToken = response.access_token;

		//no token means no successful login
		if (!userToken) {
			client.sendNotice(
				adminRoom,
				"❌ | unable to log in. This may just be a momentary error.",
			);

			return;
		}

		//sanatize pfp and displayname
		await makeUserReq("PUT", "profile", userMxid, "avatar_url", userToken, {
			avatar_url: deactivatedpfp,
		});
		await makeUserReq("PUT", "profile", userMxid, "displayname", userToken, {
			displayname: deactivateddn,
		});

		//deactivate the account
		await makeUserReq("POST", "account", "deactivate", null, userToken, {
			auth: {
				type: "m.login.password",
				user: user,
				password: newpwd,
			},
		});
	};
});

//data structure to hold various handlers
const eventHandlers = new Map();

//all m.room.message events will run through this function
eventHandlers.set("m.room.message", async (roomId, event) => {
	//if no content in message
	if (!event.content) return;

	// Don't handle non-text events
	if (event.content.msgtype !== "m.text") return;

	//if not a command, no reason to process any further
	if (!event.content.body.startsWith(prefix)) return;

	//if not the admin room, commands should not be run
	if (roomId !== adminRoom) return;

	//it is critical for this bot to be able to respond, log an error and return out if unable to send messages
	//shouldnt be a thrown error because account might be in rooms other than the admin channel
	if (
		!(await client.userHasPowerLevelFor(mxid, roomId, "m.room.message", false))
	) {
		console.log(
			`Bot does not have adequate permissions to respond in ${roomId}`,
		);
		return;
	}

	//once we know it started with the prefix we can remove the prefix for better parcing
	const contentAfterPrefix = event.content.body.substring(prefix.length);

	//split into words, and filter out the empty strings because js is an actual meme language
	const contentByWords = contentAfterPrefix.split(" ").filter((a) => a);

	//fetch handler based on the first word (the command)
	const handler = commandHandlers.get(contentByWords[0]);

	//if no handler exists indicate its an unknown command and return out
	if (!handler) {
		await client.sendEvent(roomId, "m.reaction", {
			"m.relates_to": {
				event_id: event.event_id,
				key: "❌ | invalid cmd",
				rel_type: "m.annotation",
			},
		});

		return;
	}

	//run the command handler
	handler({
		content: contentAfterPrefix,
		contentByWords: contentByWords,
		event: event,
	});
});

//when the client recieves an event
client.on("room.event", async (roomId, event) => {
	//ignore events sent by self, unless its a banlist policy update
	if (event.sender === mxid) return;

	//fetch the handler for that event type
	const handler = eventHandlers.get(event.type);

	//if no handler, nothing to run
	if (!handler) return;

	//run handler
	handler(roomId, event);
});
