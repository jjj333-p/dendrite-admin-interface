//Import dependencies
import { AutojoinRoomsMixin, MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk"; 
import { readFileSync } from "fs";
import { parse } from "yaml";

//Parse YAML configuration file
const loginFile       = readFileSync('./db/login.yaml', 'utf8');
const loginParsed     = parse(loginFile);
const homeserver      = loginParsed["homeserver-url"];
const accessToken     = loginParsed["login-token"];
const adminRoom       = loginParsed["administration-room"];
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

    //if the feild is empty then we should create one
    if ( !adminRoom ) {

        await client.createRoom({
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
                "users": {
                  mxid: 101
                },
                "users_default": 0
            },
            invite:authorizedUsers,
            is_direct:false,
            name:"Administration Room"
        }).catch(() => {})

    }

    //to remotely monitor how often the bot restarts, to spot issues
    client.sendText(adminRoom, "Started.")

})