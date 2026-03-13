const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const tmi = require('tmi.js');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io'); 

const app = express();
dotenv.config();

const server = http.createServer(app); 
const io = new Server(server, { 
    cors: {
        origin: ['https://jorgemantinan.github.io',
             'https://jorgemantinan.github.io/manti-twitch',
             'https://jorgemantinan.github.io/manti-twitch/'],
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
  console.log("🟢 Socket conectado:", socket.id);
  socket.on("joinRoom", ({ streamer }) => {
  const room = streamer || "default";
  console.log(`📡 Socket ${socket.id} joined room: ${room}`);
  socket.join(room);
});
  socket.on("disconnect", () => {
    console.log("🔴 Socket desconectado:", socket.id);
  });


    /*
  ===========================
  JOIN BINGO ROOM
  ===========================
  */

  socket.on("bingo:join",({streamer})=>{

      const roomName = `bingo:${streamer}`

      socket.join(roomName)

      getBingoRoom(streamer)

  })

  /*
  ===========================
  START GAME
  ===========================
  */

  socket.on("bingo:start",({streamer,cards})=>{

      const room = getBingoRoom(streamer)

      room.cards = cards
      room.drawn = []
      room.started = true
      room.lineWinner = null
      room.bingoWinner = null

  })

  /*
  ===========================
  DRAW NUMBER
  ===========================
  */

  socket.on("bingo:draw",({streamer})=>{

      const room = getBingoRoom(streamer)

      const n = drawBingoNumber(room)

      if(!n) return

      io.to(`bingo:${streamer}`).emit("bingo:number",n)

      for(const player in room.cards){

          const card = room.cards[player]

          if(!room.lineWinner){

              if(checkLine(card,room.drawn)){

                  room.lineWinner = player

                  io.to(`bingo:${streamer}`).emit("bingo:line",player)

              }

          }

          if(!room.bingoWinner){

              if(checkBingo(card,room.drawn)){

                  room.bingoWinner = player

                  io.to(`bingo:${streamer}`).emit("bingo:bingo",player)

              }

          }

      }

  })

});

app.set('socketio', io);

/*
================================
BINGO ENGINE ULTRA PRO
================================
*/

const bingoRooms = {}

function createBingoRoom(streamer){

    bingoRooms[streamer] = {
        drawn:[],
        cards:{},
        started:false,
        lineWinner:null,
        bingoWinner:null
    }

}

function getBingoRoom(streamer){

    if(!bingoRooms[streamer])
        createBingoRoom(streamer)

    return bingoRooms[streamer]
}

function drawBingoNumber(room){

    if(room.drawn.length>=90)
        return null

    let n

    do{
        n = Math.floor(Math.random()*90)+1
    }
    while(room.drawn.includes(n))

    room.drawn.push(n)

    return n
}

function checkLine(card,drawn){

    for(let r=0;r<3;r++){

        let hits=0

        for(let c=0;c<9;c++){

            const n = card[r][c]

            if(n && drawn.includes(n))
                hits++

        }

        if(hits===5)
            return true
    }

    return false
}

function checkBingo(card,drawn){

    let hits=0

    for(let r=0;r<3;r++)
        for(let c=0;c<9;c++){

            const n = card[r][c]

            if(n && drawn.includes(n))
                hits++

        }

    return hits===15
}

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

  if (!authHeader)
    return res.status(401).json({ error: "No token provided" });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      accessToken: decoded.twitchToken,
      refreshToken: decoded.refreshToken,
      twitchId: decoded.twitchId,
      scopes: decoded.scopes
    };
    next();

  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

async function refreshTwitchToken(refreshToken) {

  const response = await axios.post(
    "https://id.twitch.tv/oauth2/token",
    null,
    {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken
      }
    }
  );

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token
  };

}

let subsCache = {
  data: null,
  timestamp: 0
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
    const response = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      null,
      {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.TWITCH_REDIRECT_URI
        }
      }
    );

    const twitchToken = response.data.access_token;
    const refreshToken = response.data.refresh_token;
    const scopes = response.data.scope || [];

    const userRes = await axios.get(
      'https://api.twitch.tv/helix/users',
      {
        headers: {
          Authorization: `Bearer ${twitchToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID
        }
      }
    );

    const twitchId = userRes.data.data[0].id;

    const userToken = jwt.sign(
      {
        twitchToken,
        refreshToken,
        twitchId,
        scopes
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.redirect(`https://jorgemantinan.github.io/manti-twitch/?token=${userToken}`);

  } catch (error) {
    console.error("OAuth Error:", error.response?.data || error.message);
    res.status(500).send("Error autenticando con Twitch");
  }
});


/**
 * Functions
 */

// Get Id of Nickname
async function getTwitchIdByNick(nick, accessToken) {
  const response = await fetch(`https://api.twitch.tv/helix/users?login=${nick}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID
    }
  });
  const data = await response.json();
  return data.data?.[0]?.id || null; // Devuelve el ID o null si no existe
}

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



// Endpoint GET subs of twitch between dates
app.post('/api/subs', verifyToken, async (req, res) => {

  try {
    const { accessToken, refreshToken, twitchId } = req.user;

    if (
      subsCache.data &&
      Date.now() - subsCache.timestamp < 60000
    ) {
      return res.json(subsCache.data);
    }

    const baseUrl = `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${twitchId}&first=100`;
    let allSubs;

    try {
      allSubs = await fetchAllTwitchData(baseUrl, accessToken);
    } catch (err) {
      if (err.response?.status === 401) {
        console.log("🔄 Refreshing Twitch token...");

        const newTokens = await refreshTwitchToken(refreshToken);

        allSubs = await fetchAllTwitchData(
          baseUrl,
          newTokens.access_token
        );
      } else {
        throw err;
      }
    }

    const formattedSubs = allSubs.map(sub => ({
      user_name: sub.user_name,
      tier: sub.tier,
      is_gift: sub.is_gift,
      gifter_name: sub.gifter_name || null
    }));

    const responseData = {
      totalSubs: formattedSubs.length,
      subscribers: formattedSubs
    };

    subsCache.data = responseData;
    subsCache.timestamp = Date.now();

    res.json(responseData);

  } catch (error) {
    console.error("Subs endpoint error:", error.response?.data || error.message);
    res.status(500).json({ error: "Error obteniendo subs" });
  }
});

// Endpoint GET subs of twitch between dates WITH FILTERS GIFTERS
app.get('/api/subs-history', verifyToken, async (req, res) => {
  const { startDate, endDate, subType } = req.query; 
  const { accessToken, twitchId } = req.user;

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


// ENDPOINT GET FOLLOWERS BETWEEN DATES
// GET /api/followers-between-dates
// GET /api/followers-between-dates?startDate=2024-01-01
// GET /api/followers-between-dates?startDate=2024-01-01&endDate=2024-12-31
app.post('/api/followers-between-dates', verifyToken, async (req, res) => {
  const { startDate, endDate, streamerNick } = req.body; 
  const { accessToken } = req.user; // Tu token de moderador

  try {
    const targetId = await getTwitchIdByNick(streamerNick, accessToken);
    
    if (!targetId) {
      return res.status(404).json({ error: "Streamer no encontrado" });
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${targetId}&first=100`;
    const allFollowers = await fetchAllTwitchData(url, accessToken);

    // 4. Filtramos
    const filtered = allFollowers.filter(f => {
      const followDate = new Date(f.followed_at);
      return followDate >= start && followDate <= end;
    });

    res.json(filtered);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al consultar la API de Twitch" });
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
  selectedStreamer: undefined,
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
    const { selectedStreamer, keyword, subMult, giftMult, startDate, endDate } = req.body;
    const { accessToken, twitchId } = req.user;

    let streamerToJoin;

    try {

      if (!selectedStreamer) {
            const userRes = await axios.get('https://api.twitch.tv/helix/users', {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`, 
                    'Client-Id': process.env.TWITCH_CLIENT_ID 
                }
            });
            streamerToJoin = userRes.data.data[0].login;
        } else {
            streamerToJoin = selectedStreamer;
        }

        if (!client.getChannels().includes(`#${streamerToJoin}`)) {
            await client.join(streamerToJoin);
        }
        console.log(`🚀 Bot joined channel: ${streamerToJoin}`);

        // REINICIAR ESTADO DEL SORTEO
        raffleState.active = false;
        raffleState.participants.clear();
        raffleState.cachedSubs.clear();
        
        raffleState.selectedStreamer = streamerToJoin;
        raffleState.keyword = keyword;
        raffleState.subMult = parseFloat(subMult) || 1;
        raffleState.giftMult = parseFloat(giftMult) || 1;
        raffleState.startDate = startDate ? new Date(startDate) : new Date(0);
        raffleState.endDate = endDate ? new Date(endDate) : new Date();

        // PRE-CARGA MASIVA DE SUBS (Performance O(1))
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

        // ACTIVAR ESCUCHA DE MENSAJES
        raffleState.active = true;
        res.json({ 
            status: "success", 
            message: `Sorteo iniciado en el canal ${streamerToJoin}.`,
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
  if (!raffleState.active || self || !message.toLowerCase().includes(raffleState.keyword.toLowerCase())) {
    return;
  }

  const username = tags.username.toLowerCase();
  const displayName = tags['display-name'];

  if (raffleState.participants.has(username)) return;

  let totalPoints = 1;
  const userData = raffleState.cachedSubs.get(username);

  if (userData) {
    if (userData.isSub) totalPoints *= raffleState.subMult;
    if (userData.giftsSent > 0) totalPoints += (userData.giftsSent * raffleState.giftMult);
  }

  const newParticipant = {
    username: displayName,
    points: totalPoints,
    isSub: userData ? userData.isSub : false,
    giftsSent: userData ? userData.giftsSent : 0
  };

  raffleState.participants.set(username, newParticipant);

  io.to(raffleState.selectedStreamer || "default").emit('newParticipant', {
    participant: newParticipant,
    totalCount: raffleState.participants.size
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

server.listen(process.env.PORT , () => {
  console.log(`Server running on port ${process.env.PORT}`);
});