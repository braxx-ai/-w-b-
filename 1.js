// server.js - proxy para reconocimiento con AudD (ejemplo)
// Uso: AUDD_API_TOKEN=tu_token node server.js
//
// NOTA: instala dependencias:
//   npm init -y
//   npm install express multer axios form-data cors

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const upload = multer({ dest: 'uploads/' });
const app = express();
app.use(cors()); // en producción restringe el origen
app.use(express.json());

const AUDD_API_TOKEN = process.env.AUDD_API_TOKEN || ''; // pon tu token aquí en la variable de entorno
if(!AUDD_API_TOKEN){
  console.warn('Warning: no AUDD_API_TOKEN definido. /recognize fallará si no lo configuras.');
}

// POST /recognize
// recibe multipart/form-data con 'file' (archivo de audio) y opcional 'want_cover'
app.post('/recognize', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const wantCover = req.body.want_cover === 'true' || req.body.want_cover === '1';

    if(!file) return res.status(400).json({ success:false, message:'no file' });

    // Construir form-data para AudD
    const form = new FormData();
    form.append('api_token', AUDD_API_TOKEN);
    // enviar el archivo como 'file'
    form.append('file', fs.createReadStream(file.path), { filename: file.originalname });
    // pedir retorno de links (cover) si se quiere
    if(wantCover) form.append('return', 'timecode,apple_music,spotify,deezer,lyrics,album,release,genre');

    // llamar a AudD
    const auddResp = await axios.post('https://api.audd.io/', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 45000
    });

    // limpiar archivo temporal
    try { fs.unlinkSync(file.path); } catch(e){}

    // procesar respuesta de AudD
    if(!auddResp.data){
      return res.json({ success:false, message:'no response from audd' });
    }

    // AudD responde normalmente con { status, result } o { status:'success', result:null }
    if(auddResp.data.status === 'success' && auddResp.data.result){
      // auddResp.data.result puede ser object o array (si multiple), normalizamos
      const r = Array.isArray(auddResp.data.result) ? auddResp.data.result[0] : auddResp.data.result;
      // campo r.title, r.artist, r.album, r.spotify.album.images[0].url, etc
      let coverUrl = null;
      if(r.spotify && r.spotify.album && r.spotify.album.images && r.spotify.album.images[0]) coverUrl = r.spotify.album.images[0].url;
      if(!coverUrl && r.album && r.album.cover) coverUrl = r.album.cover;
      if(!coverUrl && r.release && r.release.cover) coverUrl = r.release.cover;
      // También AudD puede devolver r.apple_music.album.artwork.urlTemplate
      if(!coverUrl && r.apple_music && r.apple_music.album && r.apple_music.album.artwork && r.apple_music.album.artwork.urlTemplate){
        coverUrl = r.apple_music.album.artwork.urlTemplate.replace('{w}','1000').replace('{h}','1000');
      }

      const result = {
        title: r.title || null,
        artist: r.artist || null,
        album: (r.album && r.album.title) ? r.album.title : (r.release && r.release.title ? r.release.title : null),
        cover: coverUrl || null,
        raw: r
      };
      return res.json({ success:true, result });
    } else {
      // no encontrado
      return res.json({ success:false, message:'not found', raw: auddResp.data });
    }
  } catch(err){
    console.error('recognize error', err && err.stack ? err.stack : err);
    return res.status(500).json({ success:false, message: String(err && err.message ? err.message : err) });
  }
});

const PORT = process.env.PORT || 3000;
app.use('/', express.static(path.join(__dirname, 'public'))); // opcional: sirve archivos estáticos
app.listen(PORT, ()=> console.log('Server running on port', PORT));