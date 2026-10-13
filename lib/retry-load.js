'use strict';
/* Charge un module en réessayant si Node refuse un package.json (ERR_INVALID_PACKAGE_CONFIG).
   Sur un volume réseau, une lecture faite pendant ou juste après une installation peut renvoyer un fichier incomplet :
   le fichier est sain quelques secondes plus tard. Un module dont le chargement échoue est retiré du cache par Node :
   on peut donc simplement recommencer. */
function pause(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function loadWithRetry(loader, { tries = 6, wait = 500, sleep = pause, log = console } = {}) {
  for (let i = 1; ; i++) {
    try { return loader(); }
    catch (e) {
      if (!e || e.code !== 'ERR_INVALID_PACKAGE_CONFIG' || i >= tries) { throw e; }
      log.warn(`Lexiquest : lecture d'un package.json refusée (${e.message}) ; nouvel essai ${i}/${tries - 1}...`);
      sleep(wait * i);
    }
  }
}
module.exports = { loadWithRetry };
