# dendrite-admin-interface
A bot interface for administrating a Dendrite server using the administration api and some database interfacing

This project is in it's very baby stages. Contributions are very welcome however it is recomended at this time that you join the discussion room before contributing to ensure your contributions align with the end goal of the project

Feel free to make a issue for each requested feature so when I finally get time I have a list to go through and check off.

Currently implemented commands:

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
    > **TODO:** Add confirmation prompt
    - `mxid/localpart` - you can supply either the localpart of a user (i.e. `jjj333`), or the entire mxid (i.e. `@jjj333:pain.agency`). Do note that this has to be a local user as there is nothing that can be done for remote users.
    - Sets the displayname and pfp to those defined in the bot login.yaml as dendrite doesnt remove these before deactivating, therefore we need to sanatize, and we can add flair to it in the meantime.

Space: [#admin-interface:pain.agency](https://matrix.to/#/#admin-interface:pain.agency)
Discussion Room: [#admin-interface-support:pain.agency](https://matrix.to/#/%23admin-interface-support%3Apain.agency)