'use strict';

const log = require('../lib/log');
const fetch = require('node-fetch');
const signalSets = require('../models/signal-sets');
const adminContext = require('../lib/context-helpers').getAdminContext();

async function insert1() { //pridat try-catch a rekurzivne pres setTimeout
    const fetched = await fetch('https://onemocneni-aktualne.mzcr.cz/api/v2/covid-19/zakladni-prehled.json');
    const result = await fetched.json();

    const sigSetWithSigMap = await signalSets.getById(adminContext, 2, false, true);
    await signalSets.insertRecords(adminContext, sigSetWithSigMap, [{id: '2', signals: {siga1: 314}}]);


    log.info('Alerts', 'Alerts evaluator started');
}

function run() {
    setTimeout(insert1, 5000);
}

module.exports.run = run;
