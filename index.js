//Import dependencies
import { AutojoinRoomsMixin, MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk"; 
import fs from "fs";
import yaml from "js-yaml";

//Parse YAML configuration file
let   loginFile       = fs.readFileSync('./db/login.yaml', 'utf8');
let   loginParsed     = yaml.load(loginFile);
const homeserver      = loginParsed["homeserver-url"];
const accessToken     = loginParsed["login-token"];
let   adminRoom       = loginParsed["administration-room"];
const prefix          = loginParsed["prefix"]
const authorizedUsers = loginParsed["authorized-users"];

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserver, accessToken, storage);

//preallocate variables so they have a global scope
let mxid; 

//Start Client
client.start().then( async () => {

  console.log("Client started!")

  //get mxid
  mxid = await client.getUserId()

  //create pl feild for each authorized user
  let authorizedPL = {[mxid]:101}
  authorizedUsers.forEach(a => authorizedPL[a] = 100)

  //if the feild is empty then we should create a room
  if ( !adminRoom ) {

    adminRoom = await client.createRoom({
        initial_state:[
          {
              content: {
                join_rule: "invite"
              },
              state_key: "",
              type: "m.room.join_rules"
          },
          {
              content: {
                "history_visibility": "joined"
              },
              state_key: "",
              type: "m.room.history_visibility"
          },
        ],
        power_level_content_override:{
          "ban": 50,
          "events": {
            "m.room.avatar": 50,
            "m.room.canonical_alias": 50,
            "m.room.encryption": 100,
            "m.room.history_visibility": 100,
            "m.room.name": 50,
            "m.room.power_levels": 100,
            "m.room.server_acl": 100,
            "m.room.tombstone": 100
          },
          "events_default": 0,
          "invite": 0,
          "kick": 50,
          "notifications": {
            "room": 50
          },
          "redact": 50,
          "state_default": 50,
          "users": authorizedPL,
          "users_default": 0
      },
      invite:authorizedUsers,
      is_direct:false,
      name:"Administration Room"
    })

    //write new room id to the login file
    loginParsed["administration-room"] = adminRoom
    loginFile = yaml.dump(loginParsed)
    fs.writeFile('./db/login.yaml', loginFile, () => {})

  }

  // to remotely monitor how often the bot restarts, to spot issues
  client.sendText(adminRoom, "Started.")

    //if there is no room to work in there is no reason for the bot to be online
    .catch(() => {
      console.log("The bot is either not in the administration room, or does not have permission to send messages into it. Suggested remedy: empty `administration-room:` feild from login.yaml and let the bot create a new room.")
      process.exit(1)
    })

})
/*
Makes an internal request to the global `homeserver` address following standard dendrite request.
*/
async function makeDendriteReq (reqType, command, arg1, arg2, body) {

  //base url guaranteed to always be there
  let url = homeserver + "/_dendrite/admin/" + command + "/" + arg1

  //if there is a second argument add it 
  if (arg2) url += ("/" + arg2)

  //if body is supplied, stringify it to send in http request
  let bodyStr = null
  if (body) bodyStr = JSON.stringify(body)

  //make the request and return whatever the promise resolves to
  return (
    (await fetch(url, {
      method: reqType,
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body:bodyStr
    })).json()
  )

}

//data structure to hold various handlers
let eventHandlers = new map()

//all m.room.message events will run through this function
eventHandlers.set("m.room.message", async (roomId, event) => {

  //if no content in message
  if (! event["content"]) return;

  // Don't handle non-text events
  if (event["content"]["msgtype"] !== "m.text") return;

  //filter out events sent by the bot itself.
  if (event["sender"] === await client.getUserId()) return;

  //if not a command, no reason to process any further
  if (!event["content"]["body"].startsWith(prefix)) return;

  //if not the admin room, commands should not be run
  if (roomId != adminRoom) return;

  //it is critical for this bot to be able to respond, log an error and return out if unable to send messages
  //shouldnt be a thrown error because account might be in rooms other than the admin channel
  if (!(await client.userHasPowerLevelFor(mxid, roomId, "m.room.message", false))) { console.log( "Bot does not have adequate permissions to respond in " + roomId ); return }

  //once we know it started with the prefix we can remove the prefix for better parcing 
  let contentAfterPrefix = event["content"]["body"].substring(prefix.length)

  //split into words, and filter out the empty strings because js is an actual meme language
  let contentByWords = contentAfterPrefix.split(" ").filter(a=>a)

})