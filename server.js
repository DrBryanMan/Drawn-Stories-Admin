// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const parserRouter = require('./routes/parser');

const { initDatabase } = require('./db');

const volumesRouter      = require('./routes/volumes');
const issuesRouter       = require('./routes/issues');
const charactersRouter   = require('./routes/characters');
const themesRouter       = require('./routes/themes');
const collectionsRouter  = require('./routes/collections');
const { mangaRouter }    = require('./routes/collections');
const seriesRouter       = require('./routes/series');
const readingOrderRouter = require('./routes/readingOrders');
const personnelRouter    = require('./routes/personnel');
const eventsRouter       = require('./routes/events');
const statsRouter        = require('./routes/stats');
const wantedRouter       = require('./routes/wanted');
const publishersRouter   = require('./routes/publishers');

const app  = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/volumes',        volumesRouter);
app.use('/api/issues',         issuesRouter);
app.use('/api/characters',     charactersRouter);
app.use('/api/themes',         themesRouter);
app.use('/api/collections',    collectionsRouter);
app.use('/api/manga',          mangaRouter);
app.use('/api/series',         seriesRouter);
app.use('/api/reading-orders', readingOrderRouter);
app.use('/api/personnel',      personnelRouter);
app.use('/api/events',         eventsRouter);
app.use('/api/stats',          statsRouter);
app.use('/api/wanted',         wantedRouter);
app.use('/api/publishers',     publishersRouter);
app.use('/api/parser',         parserRouter);

// Окремий HTML-роут для wanted-сторінки
app.get('/wanted', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wanted.html'));
});

initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Сервер запущено на http://localhost:${PORT}`));
});

process.on('SIGINT', () => {
  const { closeDatabase } = require('./db');
  closeDatabase();
  process.exit(0);
});