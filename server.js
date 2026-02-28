require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({
    origin: 'https://jorgemantinan.github.io/manti-twitch/'
}));
app.use(express.json());

// Main
app.get('/', (req, res) => {
  res.send('<h1>🚀 Tamoh ready 🚀</h1>');
});

// 1. Redirigir a Twitch (esto lo inicia el móvil)
app.get('/auth/twitch', (req, res) => {
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${process.env.TWITCH_REDIRECT_URI}&response_type=code&scope=moderator:read:chatters`;
    res.redirect(url);
});

// 2. Callback: Twitch nos da el código
app.get('/auth/twitch/callback', async (req, res) => {
    const { code } = req.query;

    try {
        // Intercambiamos código por Token real
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.TWITCH_REDIRECT_URI
            }
        });

        const twitchToken = response.data.access_token;

        // Creamos nuestro propio JWT para el móvil
        const userToken = jwt.sign({ twitchToken }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Redirigimos de vuelta a la App con el token (usando un Deep Link)
        res.redirect(`tuapp://login?token=${userToken}`);
    } catch (error) {
        res.status(500).send('Error en la autenticación');
    }
});

// 3. Endpoint Protegido para obtener chatters
app.get('/api/chatters', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).send("No hay token");
        
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        const token = decoded.twitchToken;

        // 1. Obtener tu propio ID (el del moderador logueado)
        const userRes = await axios.get('https://api.twitch.tv/helix/users', {
            headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID }
        });
        const moderatorId = userRes.data.data[0].id;

        // 2. Obtener el ID de ceo_dos
        const broadcasterRes = await axios.get('https://api.twitch.tv/helix/users?login=ceo_dos', {
            headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID }
        });
        const broadcasterId = broadcasterRes.data.data[0].id;

        // 3. Obtener la lista de chatters
        const chattersRes = await axios.get(`https://api.twitch.tv/helix/chat/chatters`, {
            params: { broadcaster_id: broadcasterId, moderator_id: moderatorId },
            headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID }
        });

        // Enviamos solo los nombres de usuario al frontend
        const listaNombres = chattersRes.data.data.map(user => user.user_login);
        res.json({ chatters: listaNombres });

    } catch (e) {
        console.error("Error API Twitch:", e.response?.data || e.message);
        res.status(500).json({ error: "No se pudo obtener la lista" });
    }
});

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));