'use strict';

const fetch = require('node-fetch');
const signalSets = require('../models/signal-sets');
const adminContext = require('../lib/context-helpers').getAdminContext();

async function insertCovid() {
    try {
        const fetched = await fetch('https://onemocneni-aktualne.mzcr.cz/api/v2/covid-19/zakladni-prehled.json');
        const result = await fetched.json();
        const data = result.data[0];

        const sigs = {
            deaths: data.umrti,
            newCases: data.potvrzene_pripady_vcerejsi_den,
            newTests: data.provedene_testy_vcerejsi_den,
            newCases65: data.potvrzene_pripady_65_vcerejsi_den,
            inHospital: data.aktualne_hospitalizovani
        };
        const record = {id: data.datum, signals: sigs};

        const sigSetWithSigMap = await signalSets.getById(adminContext, 1, false, true);
        await signalSets.insertRecords(adminContext, sigSetWithSigMap, [record]);
    }
    catch (e) {}

    const minuteDelay = Math.floor((Math.random() * 180) + 180);
    setTimeout(insertCovid, minuteDelay * 60 * 1000);
}

async function insertWeather() {
    try {
        const fetchedPrague = await fetch('http://api.openweathermap.org/data/2.5/find?units=metric&q=Prague,cz&appid=1b4ffc9a1109ae46e5cc623d293edc69');
        const fetchedVimperk = await fetch('http://api.openweathermap.org/data/2.5/find?units=metric&q=Vimperk,cz&appid=1b4ffc9a1109ae46e5cc623d293edc69');
        const resultPrague = await fetchedPrague.json();
        const resultVimperk = await fetchedVimperk.json();

        const sigs = {
            weatherP: resultPrague.list[0].weather[0].main,
            weatherV: resultVimperk.list[0].weather[0].main,
            tempP: resultPrague.list[0].main.temp,
            tempV: resultVimperk.list[0].main.temp,
            humP: resultPrague.list[0].main.humidity,
            windSpeedP: resultPrague.list[0].wind.speed,
            windDegP: resultPrague.list[0].wind.deg,
        };
        const record = {id: resultPrague.list[0].dt.toString(), signals: sigs};

        const sigSetWithSigMap = await signalSets.getById(adminContext, 2, false, true);
        await signalSets.insertRecords(adminContext, sigSetWithSigMap, [record]);
    }
    catch (e) {}

    const minuteDelay = Math.floor((Math.random() * 10) + 10);
    setTimeout(insertWeather, minuteDelay * 60 * 1000);
}

function run() {
    setTimeout(insertCovid, 60 * 1000);
    setTimeout(insertWeather, 70 * 1000);
}

module.exports.run = run;
