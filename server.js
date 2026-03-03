require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const tmi = require('tmi.js');

const app = express();

// Configuración del bot de Twitch
const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'manti_tiri_ri_ti',
        password: `oauth:${process.env.TWITCH_ACCESS_TOKEN}`
    },
    channels: []
});

if (!process.env.TWITCH_ACCESS_TOKEN) {
  console.error("❌ TWITCH_ACCESS_TOKEN no está definido");
}

// Conectar a Twitch
client.connect().catch(console.error);

app.use(cors({
    origin: ['https://jorgemantinan.github.io',
             'https://jorgemantinan.github.io/manti-twitch',
             'https://jorgemantinan.github.io/manti-twitch/']
}));
app.use(express.json());

/**
 * MIDDLEWARE: Verify JWT and extract Twitch Data
 * This function runs before your endpoints to ensure the user is logged in.
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    try {
        // Expected format: "Bearer <token>"
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Inject data into req.user so endpoints can access it
        req.user = { 
            accessToken: decoded.twitchToken, 
            twitchId: decoded.twitchId 
        };
        
        next(); // Continue to the endpoint
    } catch (err) {
        console.error("JWT Verification Error:", err.message);
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};

/**
 * AUTHENTICATION ENDPOINTS
 */

app.get('/', (req, res) => {
  res.send('<h1>🚀</h1>');
});

app.get('/auth/twitch', (req, res) => {
    const cleanRedirectUri = process.env.TWITCH_REDIRECT_URI.trim();
    const scopes = [
    'moderator:read:chatters',
    'channel:read:subscriptions',
    'moderator:read:followers'
    ].join(' '); // Esto crea la cadena con espacios

const url = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(cleanRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;

    res.redirect(url);
});

// Callback: Twitch Login
app.get('/auth/twitch/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.TWITCH_REDIRECT_URI
            }
        });

        const twitchToken = response.data.access_token;

        // NEW: Get user ID from Twitch before signing our JWT
        const userRes = await axios.get('https://api.twitch.tv/helix/users', {
            headers: { 'Authorization': `Bearer ${twitchToken}`, 'Client-Id': process.env.TWITCH_CLIENT_ID }
        });
        const twitchId = userRes.data.data[0].id;

        // Sign JWT including both Token and ID
        const userToken = jwt.sign({ twitchToken, twitchId }, process.env.JWT_SECRET, { expiresIn: '2h' });

        res.redirect(`https://jorgemantinan.github.io/manti-twitch/?token=${userToken}`);
    } catch (error) {
        res.status(500).send('Error en la autenticación');
    }
});


/**
 * Functions
 */

// High-Performance Pager
async function fetchAllTwitchData(url, token) {
  let allData = [];
  let cursor = '';
  
  try {
    do {
      const response = await axios.get(`${url}${cursor ? `&after=${cursor}` : ''}`, {
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Client-Id': process.env.TWITCH_CLIENT_ID 
        }
      });

      allData.push(...response.data.data);
      cursor = response.data.pagination?.cursor;

      // Si nos quedan pocas peticiones en el "cubo" de Twitch, esperamos un poco
      const remaining = response.headers['ratelimit-remaining'];
      if (remaining && parseInt(remaining) < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } while (cursor);
    
    return allData;
  } catch (error) {
    console.error("Error en paginación:", error.response?.data || error.message);
    throw error;
  }
}


/**
 * PRACTICAL ENDPOINTS
 */

// Endpoint GET chatters
app.get('/api/chatters', verifyToken, async (req, res) => {
    try {
        const { accessToken, twitchId } = req.user;

        const broadcasterId = twitchId; 

        const chattersRes = await axios.get(`https://api.twitch.tv/helix/chat/chatters`, {
            params: { broadcaster_id: broadcasterId, moderator_id: twitchId },
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Client-Id': process.env.TWITCH_CLIENT_ID 
            }
        });

        const listaNombres = chattersRes.data.data.map(user => user.user_login);
        res.json({ chatters: listaNombres });

    } catch (e) {
        console.error("Error API Twitch Chatters:", e.response?.data || e.message);
        res.status(500).json({ error: "No se pudo obtener la lista de chatters" });
    }
});

// Endpoint GET subs of twitch between dates
app.get('/api/subs', verifyToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { accessToken, twitchId } = req.user;

        // Usamos nuestra función de paginación para no dejarnos ningún sub fuera
        const baseUrl = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${twitchId}&first=100`;
        const allSubs = await fetchAllTwitchData(baseUrl, accessToken);

        const filteredSubs = allSubs.filter(sub => {
            const subDate = new Date(sub.created_at);
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date();
            return subDate >= start && subDate <= end;
        });

        res.json({ 
            totalLoaded: allSubs.length,
            subscribers: filteredSubs 
        });
    } catch (e) {
        console.error("Error en Subs:", e.response?.data || e.message);
        res.status(500).json({ error: "No se pudieron obtener tus suscripciones" });
    }
});

// Endpoint GET subs of twitch between dates WITH FILTERS GIFTERS
app.get('/api/subs-history', verifyToken, async (req, res) => {
  const { startDate, endDate, subType } = req.query; 
  const { accessToken, twitchId } = req.user; // Now this works!

  try {
    const url = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${twitchId}&first=100`;
    const allSubs = await fetchAllTwitchData(url, accessToken);

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let filtered = allSubs.filter(s => {
      const subDate = new Date(s.created_at);
      return subDate >= start && subDate <= end;
    });

    if (subType === 'only_gifters') {
      const giftersMap = new Map();
      filtered.filter(s => s.is_gift).forEach(s => {
        const count = giftersMap.get(s.gifter_name) || 0;
        giftersMap.set(s.gifter_name, count + 1);
      });
      return res.json(Object.fromEntries(giftersMap));
    }

    if (subType === 'non_gifted') filtered = filtered.filter(s => !s.is_gift);

    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: "Error processing sub data" });
  }
});


let globalChatLogs = [];
// ENDPOINT GET ACTIVE FOLLOWERS THAT HAVED CHATTED BETWEEN DATES
app.get('/api/active-followers', verifyToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  const { accessToken, twitchId } = req.user; // Now this works!

  try {
    const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${twitchId}&first=100`;
    const allFollowers = await fetchAllTwitchData(url, accessToken);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const activeChatters = new Set(
      globalChatLogs
        .filter(log => log.timestamp >= start && log.timestamp <= end)
        .map(log => log.user.toLowerCase())
    );

    const result = allFollowers.filter(f => activeChatters.has(f.user_login.toLowerCase()));
    res.json(result);
  } catch (error) {
    res.status(500).send(error.message);
  }
});


/**
* ENDPOINT: Raffle Listener with Multipliers (High Availability)
* STRATEGY: "Pre-load & Cache" to support over 5,000 simultaneous messages and over 30,000 subscribers.
* 1. Upon activation (START), the server downloads and dumps the entire subscriber list into a Map.
* 2. Message processing is performed in local memory (O(1)), preventing crashes due to the Twitch API's Rate Limits (429) when receiving massive traffic spikes.
* 3. Avoids asynchronous requests for each message, ensuring the server does not crash.
*/
let raffleState = {
  active: false,
  keyword: '',
  subMult: 1,
  giftMult: 1,
  startDate: null,
  endDate: null,
  cachedSubs: new Map(), // Key: username, Value: { isSub: boolean, giftsSent: number }
  participants: new Map() // Avoid duplicates on chat
};

/**
 * ENDPOINT: RAFFLE START
 * Logic: Authenticates, joins the streamer's chat, and pre-loads sub data.
 */
app.post('/api/raffle/start', verifyToken, async (req, res) => {
    const { keyword, subMult, giftMult, startDate, endDate } = req.body;
    const { accessToken, twitchId } = req.user; // Extract from JWT Middleware

    try {
        // 1. OBTENER NOMBRE DEL STREAMER (Para que el bot sepa a qué chat ir)
        const userRes = await axios.get('https://api.twitch.tv/helix/users', {
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Client-Id': process.env.TWITCH_CLIENT_ID 
            }
        });
        const streamerLogin = userRes.data.data[0].login;

        // 2. UNIR EL BOT AL CHAT DINÁMICAMENTE
        // El bot entra al canal del usuario que acaba de loguearse
        await client.join(streamerLogin);
        console.log(`🚀 Bot joined channel: ${streamerLogin}`);

        // 3. REINICIAR ESTADO DEL SORTEO
        raffleState.active = false;
        raffleState.participants.clear();
        raffleState.cachedSubs.clear();
        
        raffleState.keyword = keyword;
        raffleState.subMult = parseFloat(subMult) || 1;
        raffleState.giftMult = parseFloat(giftMult) || 1;
        raffleState.startDate = new Date(startDate);
        raffleState.endDate = new Date(endDate);

        // 4. PRE-CARGA MASIVA DE SUBS (Performance O(1))
        const baseUrl = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${twitchId}&first=100`;
        const allSubs = await fetchAllTwitchData(baseUrl, accessToken);

        allSubs.forEach(sub => {
            const subDate = new Date(sub.created_at);
            const recipient = sub.user_name.toLowerCase();
            const gifter = sub.gifter_name ? sub.gifter_name.toLowerCase() : null;

            // Cache status de suscriptor
            if (!raffleState.cachedSubs.has(recipient)) {
                raffleState.cachedSubs.set(recipient, { isSub: true, giftsSent: 0 });
            } else {
                raffleState.cachedSubs.get(recipient).isSub = true;
            }

            // Conteo de regalos en el rango de fechas
            if (sub.is_gift && gifter && subDate >= raffleState.startDate && subDate <= raffleState.endDate) {
                const gifterData = raffleState.cachedSubs.get(gifter) || { isSub: false, giftsSent: 0 };
                gifterData.giftsSent += 1;
                raffleState.cachedSubs.set(gifter, gifterData);
            }
        });

        // 5. ACTIVAR ESCUCHA DE MENSAJES
        raffleState.active = true;
        
        res.json({ 
            status: "success", 
            message: `Sorteo iniciado en el canal ${streamerLogin}.`,
            totalSubs: allSubs.length 
        });

    } catch (error) {
        console.error("Error in Raffle Start:", error.response?.data || error.message);
        res.status(500).json({ error: "No se pudo iniciar el sorteo o unir el bot al chat." });
    }
});


/**
 * ENDPOINT: STOP RAFFLE
 * Purpose: Deactivates the chat listener and returns the final participant list.
 * Performance: O(N log N) due to sorting, where N is the number of unique participants.
 */
app.post('/api/raffle/stop', (req, res) => {
  try {
    // 1. Disable the real-time message listener
    raffleState.active = false;

    // 2. Convert the Participant Map into an Array for the Frontend
    const finalParticipants = Array.from(raffleState.participants.values());

    /**
     * 3. Sort by Points (Descending Order)
     * Users with higher points (Subs/Gifters) will appear at the top.
     */
    finalParticipants.sort((a, b) => b.points - a.points);

    // 4. Send the structured response
    res.json({
      status: "success",
      totalParticipants: finalParticipants.length,
      data: finalParticipants
    });

  } catch (error) {
    console.error("Error stopping raffle:", error.message);
    res.status(500).json({ error: "Failed to process final raffle data." });
  }
});

/**
 * TMI.js Chat Listener
 * logic: Processes keyword entries using the pre-loaded subscriber cache.
 * Efficiency: O(1) lookup time per message using Map.has() and Map.get().
 */

client.on('message', (channel, tags, message, self) => {
  // Ignore if: raffle is inactive, message is from the bot, or keyword is missing
  if (!raffleState.active || self || !message.toLowerCase().includes(raffleState.keyword.toLowerCase())) {
    return;
  }

  const username = tags.username.toLowerCase();
  const displayName = tags['display-name'];

  // Prevent duplicate entries from the same user to save CPU cycles
  if (raffleState.participants.has(username)) return;

  // 1. Set Base Entry Point (Standard for all viewers)
  let totalPoints = 1;

  /**
   * 2. Subscriber & Gifter Logic
   * Lookup user data in the O(1) memory cache pre-loaded at 'raffle/start'.
   */
  const userData = raffleState.cachedSubs.get(username);

  if (userData) {
    // Apply Multiplier if the user is a current Subscriber
    if (userData.isSub) {
      totalPoints *= raffleState.subMult;
    }
    
    // Add Bonus Points for Sub-Gifts sent within the specified Date Range
    if (userData.giftsSent > 0) {
      totalPoints += (userData.giftsSent * raffleState.giftMult);
    }
  }

  /**
   * 3. Register Participant
   * We store the Display Name (correct casing) and calculated points.
   */
  raffleState.participants.set(username, {
    username: displayName,
    points: totalPoints,
    isSub: userData ? userData.isSub : false,
    giftsSent: userData ? userData.giftsSent : 0
  });
});

/**
 * ENDPOINT: PICK RANDOM WINNER WITH PROBABILITY
 */
app.post('/api/raffle/pick-winner', (req, res) => {
  const participants = Array.from(raffleState.participants.values());

  if (participants.length === 0) {
    return res.status(400).json({ error: "No hay participantes en el sorteo." });
  }

  const totalWeight = participants.reduce((acc, p) => acc + p.points, 0);

  let random = Math.random() * totalWeight;

  let winner = null;
  for (const p of participants) {
    if (random < p.points) {
      winner = p;
      break;
    }
    random -= p.points;
  }

  res.json({
    status: "success",
    winner: winner,
    stats: {
      totalParticipants: participants.length,
      totalTicketsInUrn: totalWeight,
      probability: ((winner.points / totalWeight) * 100).toFixed(2) + "%"
    }
  });
});

app.listen(3000, () => console.log('Servidor corriendo en puerto 3000'));