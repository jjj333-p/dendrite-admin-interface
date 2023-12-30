//Import dependencies
import mbs  from "matrix-bot-sdk"; 
import fs   from "fs";
import yaml from "js-yaml";
import pg   from "pg";

//Parse YAML configuration file
let   loginFile       = fs.readFileSync('./db/login.yaml', 'utf8');
let   loginParsed     = yaml.load(loginFile);
const homeserver      = loginParsed["homeserver-url"];
const port            = loginParsed["port"];
const accessToken     = loginParsed["login-token"];
let   adminRoom       = loginParsed["administration-room"];
const prefix          = loginParsed["prefix"]
const authorizedUsers = loginParsed["authorized-users"];
const dendriteyaml    = loginParsed["dendriteyaml"];

//if the interface config does not supply a path
if (!dendriteyaml){
  console.log("No path to dendrite configuration file found, this is necessary for the interface to run.")
  process.exit(1)
}

//read in the file
try{
  var dendriteyamlcfg = fs.readFileSync(dendriteyaml, 'utf8');
} catch (e) {
  console.log(e)
  console.log("Unable to read file " + dendriteyaml + ", was the correct path provided?")
  process.exit(1)
}

//try to parce the file
try{
  var dendriteconfig = yaml.load(dendriteyamlcfg);
} catch (e) {
  console.log(e)
  console.log("Unable to parce file " + dendriteyaml + ", is this a yaml file?")
  process.exit(1)
}

//an essential part of the dendrite configuration file
if(!dendriteconfig["global"]){
  console.log("No global block found in the dendrite configuration file. Is this a dendrite configuration file?")
  process.exit(1)
}

//is there even database information there?
if(!dendriteconfig["global"]["database"]){
  console.log("Unable to find database connection information in global config block of dendrite config.")
  process.exit(1)
}

//is there even database information there?
if(!dendriteconfig["global"]["database"]){
  console.log("Unable to find database connection information in global config block of dendrite config.")
  process.exit(1)
}

//create and start the postgres client
let pgClient = new pg.Client(dendriteconfig["global"]["database"]["connection_string"])
pgClient.connect()

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new mbs.SimpleFsStorageProvider("bot.json");

//login to client
const client = new mbs.MatrixClient(homeserver, accessToken, storage);

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
  //Dendrite only accepts requests from localhost
  let url = "http://localhost:" + port + "/_dendrite/admin/" + command + "/" + arg1

  //if there is a second argument add it 
  if (arg2) url += ("/" + arg2)

  //if body is supplied, stringify it to send in http request
  let bodyStr = null
  if (body) bodyStr = JSON.stringify(body)

  //make the request and return whatever the promise resolves to
  let response = await fetch(url, {
      method: reqType,
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body:bodyStr
    })
  return (await response.text())
}

async function evacuateUser(mxid){

  makeDendriteReq("POST", "evacuateUser", mxid)
    .then(e => client.sendHtmlNotice(adminRoom, ("Ran evacuateUser endpoint on <code>"+ mxid + "</code> with response <pre><code>" + e + "</code></pre>")) )
    .catch(e => client.sendHtmlNotice(adminRoom, ("❌ | could not make evacuateUser request with error\n<pre><code>" + e + "</code></pre>")) )

}

async function purgeRoom(roomId){

  //run purgeroom endpoint
  makeDendriteReq("POST", "purgeRoom", roomId)
    .then(e => client.sendHtmlNotice(adminRoom, ("Ran purgeRoom endpoint on <code>"+ roomId + "</code> with response <pre><code>" + e + "</code></pre>")) )
    .catch(e => client.sendHtmlNotice(adminRoom, ("❌ | could not make purgeRoom request with error\n<pre><code>" + e + "</code></pre>")) )

}

//run dendrite admin endpoint to evacuate all users from `roomId`
async function evacuateRoom(roomId, preserve){
  makeDendriteReq("POST", "evacuateRoom", roomId,)

    //if the request is successful
    .then(e => {

      client.sendHtmlNotice(adminRoom, ("Ran evacuateRoom endpoint on <code>"+ roomId + "</code> with response <pre><code>" + e + "</code></pre>"))

      //if preserve flag not provided, proceed to purgeRoom
      if (!preserve) purgeRoom(roomId);

    })

    //catch errors from the evacuateRoom request
    .catch(e => client.sendHtmlNotice(adminRoom, ("❌ | could not make evacuateRoom request with error\n<pre><code>" + e + "</code></pre>")) )
    
}

//resolves roomAlias to roomId, and runs evacuateRoom(roomId)
function evacuateRoomAlias(roomAlias, preserve) {

  client.resolveRoom(roomAlias)
    .then(r => evacuateRoom(r, preserve))
    .catch(e => client.sendHtmlNotice(adminRoom, ("❌ | Ran into the following error resolving that roomID:\n<pre><code>" + e + "</code></pre>")) )

}

//data structure to hold commands
let commandHandlers = new Map()

//evacuate command
commandHandlers.set("evacuate", ({contentByWords}) => {

  //required for mxid, roomid, and room aliases
  if ( ! contentByWords[1].includes(":") || ! contentByWords[1].includes(".") ) {

    //this command will only be runnable in the admin room so we can assume to send the error there
    client.sendHtmlNotice(adminRoom, ("❌ | <code>" + contentByWords[1] + "</code> does not appear to be a valid user ID, room ID, or room alias."))

    //no need to proceed
    return;

  }

  //check for preservation flag
  let preserve = ((contentByWords[2] == "--preserve") || ((contentByWords[2] == "-p"))) 

  //first character will tell us what type of id it is
  switch (contentByWords[1][0]) {

    //user MXID
    case "@":
      evacuateUser(contentByWords[1])
      break;

    //roomID
    case "!":
      evacuateRoom(contentByWords[1], preserve)
      break;

    //room alias
    case "#":
      evacuateRoomAlias(contentByWords[1], preserve)
      break;

    //none of the above
    default:
      client.sendHtmlNotice(adminRoom, ("❌ | <code>" + contentByWords[1] + "</code> does not appear to be a valid user ID, room ID, or room alias."))
      break;

  }

})

//data structure to hold various handlers
let eventHandlers = new Map()

//all m.room.message events will run through this function
eventHandlers.set("m.room.message", async (roomId, event) => {

  //if no content in message
  if (! event["content"]) return;

  // Don't handle non-text events
  if (event["content"]["msgtype"] !== "m.text") return;

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

  //fetch handler based on the first word (the command)
  let handler = commandHandlers.get(contentByWords[0])

  //if no handler exists indicate its an unknown command and return out
  if (!handler) {

    await datapoints.client.sendEvent(datapoints.roomId, "m.reaction", ({

        "m.relates_to": {
            "event_id":datapoints.event["event_id"],
            "key":"❌ | invalid cmd",
            "rel_type": "m.annotation"
        }

    }))

    return
  }  

  //run the command handler
  handler({content:contentAfterPrefix, contentByWords:contentByWords, event:event})

})

//when the client recieves an event
client.on("room.event", async (roomId, event) => {

  //ignore events sent by self, unless its a banlist policy update
  if (event["sender"] === mxid) return;

  //fetch the handler for that event type
  let handler = eventHandlers.get(event["type"])

  //if no handler, nothing to run
  if (!handler) return;

  //run handler
  handler(roomId, event)

})