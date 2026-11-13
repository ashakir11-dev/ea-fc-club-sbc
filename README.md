# Page bridge

This branch is the in-page bridge for one open EA Sports FC Ultimate Team web app.

It reads the club, SBC storage, the challenge on screen, and the current first team. It can place one card, set the manager, and submit that challenge. Each call waits for the page. Submit runs only when the page marks the squad valid and every requirement is one this slice can check. A login wall, a captcha, or an error dialog stops the job and leaves the page alone. Three failed place or submit actions in a row stop it.

The bridge does not buy, bid, list, open packs, or walk a set. It does not read the password or the EA session. The dock talks to it with `createBridgeClient`. The solver reads a `ClubSnapshot`.
