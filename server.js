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
app.get('/auth/callback', async (req, res) => {
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
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        
        // Aquí llamarías a la API de Twitch usando decoded.twitchToken
        // Ejemplo simplificado:
        res.json({ message: "Aquí iría la lista de usuarios" });
    } catch (e) {
        res.status(401).send("No autorizado");
    }
});

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));