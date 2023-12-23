# dendrite-admin-interface
A bot interface for administrating a Dendrite server using the administration api and some database interfacing

This project is in it's very baby stages. Contributions are very welcome however it is recomended at this time that you join the discussion room before contributing to ensure your contributions align with the end goal of the project

Feel free to make a issue for each requested feature so when I finally get time I have a list to go through and check off.

Currently implemented commands:

- `evacuate <User MXID | Room ID | Room Alias> ?<--preserve | -p>` 
    
    - When supplied a room ID or alias, the interface runs the [evacuate room endpoint](https://matrix-org.github.io/dendrite/administration/adminapi#post-_dendriteadminevacuateroomroomid) on that roomID or Alias, causing all users on this server to leave that room. If the `--preserve` or `-p` flag is **not** provided the [purge room endpoint](https://matrix-org.github.io/dendrite/administration/adminapi#post-_dendriteadminpurgeroomroomid) will also be run, purging the room state from the database.
    - When supplied with a MXID of a local user, i.e. `@localpart:your.server`, the interface will run the [evacuate user endpoint](https://matrix-org.github.io/dendrite/administration/adminapi#post-_dendriteadminevacuateuseruserid) on that user, making that account leave all rooms it is in.

Space: [#admin-interface:pain.agency](https://matrix.to/#/#admin-interface:pain.agency)
Discussion Room: [#admin-interface-support:pain.agency](https://matrix.to/#/%23admin-interface-support%3Apain.agency)