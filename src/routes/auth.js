const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

router.get("/twitch", (req, res) => {
    const scopes = ["moderator:read:chatters", "channel:read:subscriptions", "moderator:read:followers"].join(" ");
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.TWITCH_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
    res.redirect(url);
});

router.get("/twitch/callback", async (req, res) => {
    const { code } = req.query;
    try {
        const tokenRes = await axios.post("https://id.twitch.tv/oauth2/token", null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                code, grant_type: "authorization_code",
                redirect_uri: process.env.TWITCH_REDIRECT_URI,
            }
        });

        const userRes = await axios.get("https://api.twitch.tv/helix/users", {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}`, "Client-Id": process.env.TWITCH_CLIENT_ID }
        });

        const userToken = jwt.sign({
            twitchToken: tokenRes.data.access_token,
            refreshToken: tokenRes.data.refresh_token,
            twitchId: userRes.data.data[0].id,
            scopes: tokenRes.data.scope
        }, process.env.JWT_SECRET, { expiresIn: "1d" });

        res.redirect(`https://jorgemantinan.github.io/manti-twitch/?token=${userToken}`);
    } catch (e) {
        res.status(500).send("Auth failed");
    }
});

module.exports = router;