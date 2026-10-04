const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/index');

const JWT_ALGORITHMS = ["HS256"];
const JWT_EXPIRES_IN = "30d";

// One-time codes to hand the JWT to the frontend without putting it in the URL.
const exchangeCodes = new Map();
const EXCHANGE_TTL_MS = 60 * 1000;

function getCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) {
            return decodeURIComponent(part.slice(idx + 1).trim());
        }
    }
    return null;
}

function cleanupExchangeCodes() {
    const now = Date.now();
    for (const [code, entry] of exchangeCodes) {
        if (entry.expires < now) exchangeCodes.delete(code);
    }
}

function signUserJwt(user) {
    return jwt.sign({
        twitchToken: user.twitchToken,
        refreshToken: user.refreshToken,
        twitchId: user.twitchId,
        login: user.login,
        scopes: user.scopes
    }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: "HS256" });
}

router.get("/twitch", (req, res) => {
    const scopes = ["moderator:read:chatters", "channel:read:subscriptions", "moderator:read:followers"].join(" ");
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie("oauth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure,
        maxAge: 10 * 60 * 1000
    });
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.TWITCH_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`;
    res.redirect(url);
});

router.get("/twitch/callback", async (req, res) => {
    const { code, state } = req.query;
    const expectedState = getCookie(req, "oauth_state");
    res.clearCookie("oauth_state", { httpOnly: true, sameSite: "lax", secure: req.secure });

    const stateOk =
        typeof state === "string" &&
        typeof expectedState === "string" &&
        state.length === expectedState.length &&
        crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));

    if (!code || !stateOk) {
        return res.status(400).send("Auth failed");
    }

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

        const userToken = signUserJwt({
            twitchToken: tokenRes.data.access_token,
            refreshToken: tokenRes.data.refresh_token,
            twitchId: userRes.data.data[0].id,
            login: userRes.data.data[0].login,
            scopes: tokenRes.data.scope
        });

        cleanupExchangeCodes();
        const exchangeCode = crypto.randomBytes(24).toString("hex");
        exchangeCodes.set(exchangeCode, { token: userToken, expires: Date.now() + EXCHANGE_TTL_MS });

        res.redirect(`${config.frontendUrl}/?code=${exchangeCode}`);
    } catch (e) {
        res.status(500).send("Auth failed");
    }
});

// Consume a one-time code and return the JWT (never travels in the URL).
router.post("/exchange", (req, res) => {
    const { code } = req.body || {};
    if (typeof code !== "string" || !code) {
        return res.status(400).json({ error: "Missing code" });
    }

    cleanupExchangeCodes();
    const entry = exchangeCodes.get(code);
    if (!entry) {
        return res.status(400).json({ error: "Invalid or expired code" });
    }

    exchangeCodes.delete(code);
    res.json({ token: entry.token });
});

// Sliding session: re-issue the JWT while the current one is still valid.
router.post("/refresh", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: JWT_ALGORITHMS });

        const newToken = signUserJwt({
            twitchToken: decoded.twitchToken,
            refreshToken: decoded.refreshToken,
            twitchId: decoded.twitchId,
            login: decoded.login,
            scopes: decoded.scopes
        });

        res.json({ token: newToken });
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
});

module.exports = router;
