// routes/parser.js
const { Router }   = require('express');
const { execFile } = require('child_process');
const path         = require('path');

const PYTHON      = 'python';  // або 'python' на Windows
const SCRIPT_PATH = path.join(__dirname, '..', 'add_issue_by_id.py');
const DB_PATH     = "../Drawn Stories Parser/comicsdb.db";

const parserRouter = Router();


parserRouter.post('/add-issue', (req, res) => {
  const rawId = req.body?.cv_id;

  if (!rawId) {
    return res.status(400).json({ ok: false, message: "Поле cv_id обов'язкове." });
  }

  const cvId = parseInt(rawId, 10);
  if (isNaN(cvId) || cvId <= 0) {
    return res.status(400).json({ ok: false, message: 'cv_id має бути позитивним цілим числом.' });
  }

  console.log(`[parser] Запуск для CV_ID=${cvId}...`);

  execFile(PYTHON, [SCRIPT_PATH, String(cvId), '--db', DB_PATH], { timeout: 120_000, encoding: 'utf8' },
    (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      if (error?.code !== 0 && error) {
        if (stdout.includes('вже є в базі')) {
          return res.status(409).json({ ok: false, message: `CV_ID=${cvId} вже є в базі.` });
        }
        return res.status(500).json({ ok: false, message: 'Помилка парсера. Деталі в логах.' });
      }

      const successLine = stdout.split('\n')
        .find(l => l.includes('✓') && l.includes('успішно додано'));

      return res.json({ ok: true, message: successLine?.trim() || `CV_ID=${cvId} додано.` });
    }
  );
});


module.exports = parserRouter;