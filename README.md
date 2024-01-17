# dendrite-admin-interface
A bot interface for administrating a Dendrite server using the administration api and some database interfacing

Contributions are very welcome however it is recommended  at this time that you join the discussion room before contributing to ensure your contributions align with the end goal of the project

Feel free to make a issue for each requested feature so when I finally get time I have a list to go through and check off.

Space: [#admin-interface:pain.agency](https://matrix.to/#/#admin-interface:pain.agency) | 
Discussion Room: [#admin-interface-support:pain.agency](https://matrix.to/#/%23admin-interface-support%3Apain.agency)

## Setup

- Make sure you have a half recent version of node and npm installed, I currently use node `v18.18.0` (check with `node -v`) and npm version `9.2.0` on my vps. If you run debian like I do on my vps, you may wish to get a more up to date version of node from the snap store or building from source.
- Download and Unpack latest stable or beta release .zip or .tar.gz from https://github.com/jjj333-p/dendrite-admin-interface/releases or clone from `main` branch if you like to be on the *bleeding* edge.
- Run `npm install` which should install all the required dependencies.
- Copy the file found at `examples/login.yaml` to `db/login.yaml` and fill out that information. There are instructions for filling out that information within the comments of the example file.
- Run the bot (`node index.js`).
- Commands are available only in the administration room defined in the login.yaml file.

## Currently implemented commands:

- `evacuate User MXID | Room ID | Room Alias> ?<--preserve | -p>` 
    
    - When supplied a room ID or alias, the interface runs the [evacuate room endpoint](https://matrix-org.github.io/dendrite/administration/adminapi#post-_dendriteadminevacuateroomroomid) on that roomID or Alias, causing all users on this server to leave that room. If the `--preserve` or `-p` flag is **not** provided the [purge room endpoint](https://matrix-org.github.io/dendrite/administration/adminapi#post-_dendriteadminpurgeroomroomid) will also be run, purging the room state from the database.
    - When supplied with a MXID of a local user, i.e. `@localpart:your.server`, the interface will run the [evacuate user endpoint](https://matrix-org.github.io/dendrite/administration/adminapi#post-_dendriteadminevacuateuseruserid) on that user, making that account leave all rooms it is in.

- `passwd <mxid/localpart> <log out accounts?> ?<password>`

    Reset the password of a user    
    - `mxid/localpart` - you can supply either the localpart of a user (i.e. `jjj333`), or the entire mxid (i.e. `@jjj333:pain.agency`). Do note that this has to be a local user as there is nothing that can be done for remote users.
    - `log out accounts?` 
        - `t` or `true` to log out all logged in sessions of the account.
        - `f` or `false` to keep all sessions logged in.
    - `? password` - optionally set a password to reset to. If no password is supplied, it will default to a randomized 35 byte base64 string which will be returned. Because of Dendrite the password has to be at least 8 characters. Due to technical difficulties you can not have any spaces in a password set through this interface.

- `deactivate <mxid/localpart>`

    deactivates the given user
    - `mxid/localpart` - you can supply either the localpart of a user (i.e. `jjj333`), or the entire mxid (i.e. `@jjj333:pain.agency`). Do note that this has to be a local user as there is nothing that can be done for remote users.
    - Sets the displayname and pfp to those defined in the bot login.yaml as dendrite doesnt remove these before deactivating, therefore we need to sanitize, and we can add flair to it in the meantime.
    - Will ask for confirmation to prevent accidental runs
    - **NOTE**: this command is permanent, use with caution!