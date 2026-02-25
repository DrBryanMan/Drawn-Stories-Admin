// routes/parser.js
const { Router }   = require('express');
const { execFile } = require('child_process');
const path         = require('path');

const PYTHON      = 'python';
const SCRIPT_PATH = path.join(__dirname, '..', 'add_parser.py');
const DB_PATH     = "../Drawn Stories Parser/comicsdb.db";

const parserRouter = Router();


// ── Запуск скрипту з аргументами ──────────────────────────────────────────

function runScript(args, timeoutMs, res) {
  const fullArgs = [SCRIPT_PATH, ...args, '--db', DB_PATH];
  console.log(`[parser] Запуск: python ${fullArgs.join(' ')}`);

  execFile(PYTHON, fullArgs, { timeout: timeoutMs, encoding: 'utf8' },
    (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      // Парсимо останній рядок виводу як повідомлення
      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
      const lastLine = lines[lines.length - 1] || '';

      if (error && error.code !== 0) {
        if (stdout.includes('вже є в базі') || stdout.includes('Вже існує')) {
          return res.status(409).json({ ok: false, message: 'Вже є в базі.' });
        }
        return res.status(500).json({ ok: false, message: 'Помилка парсера. Деталі в логах сервера.' });
      }

      return res.json({ ok: true, message: lastLine || 'Виконано.' });
    }
  );
}


// ── POST /api/parser/add-issue ─────────────────────────────────────────────

parserRouter.post('/add-issue', (req, res) => {
  const cvId = parseInt(req.body?.cv_id, 10);
  if (!cvId || cvId <= 0)
    return res.status(400).json({ ok: false, message: "cv_id має бути позитивним числом." });

  runScript(['issue', String(cvId)], 120_000, res);
});


// ── POST /api/parser/add-volume ────────────────────────────────────────────

parserRouter.post('/add-volume', (req, res) => {
  const cvId = parseInt(req.body?.cv_id, 10);
  if (!cvId || cvId <= 0)
    return res.status(400).json({ ok: false, message: "cv_id має бути позитивним числом." });

  runScript(['volume', String(cvId)], 120_000, res);
});


// ── POST /api/parser/add-volume-issues ────────────────────────────────────

parserRouter.post('/add-volume-issues', (req, res) => {
  const cvVolId = parseInt(req.body?.cv_vol_id, 10);
  if (!cvVolId || cvVolId <= 0)
    return res.status(400).json({ ok: false, message: "cv_vol_id має бути позитивним числом." });

  // Великий таймаут — том може мати сотні випусків
  runScript(['volume-issues', String(cvVolId)], 1_800_000, res);
});


module.exports = parserRouter;