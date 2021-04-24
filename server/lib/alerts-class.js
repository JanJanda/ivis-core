'use strict';

const knex = require('./knex');
const { evaluate } = require('./alerts-condition-parser');
const moment = require('moment');
const { sendEmail } = require('./mailer');
const { sendSMS } = require('./SMS-sender');
const config = require('./config');

class Alert{
    constructor(fields) {
        this.fields = fields;
    }

    async init() {
        await this.addLogEntry('init');
        if (!this.fields.enabled) return;
        if (this.fields.repeat !== 0 && (this.fields.state === 'bad' || this.fields.state === 'better')) await this.repeatNotification();
        const elapsed = moment().diff(this.fields.state_changed);
        if (this.fields.state === 'worse') {
            if (elapsed >= this.fields.duration * 60 * 1000) await this.trigger();
            else this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), (this.fields.duration * 60 * 1000) - elapsed);
        }
        else if (this.fields.state === 'better') {
            if (elapsed >= this.fields.delay * 60 * 1000) await this.revoke();
            else this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), (this.fields.delay * 60 * 1000) - elapsed);
        }

        if (this.fields.interval !== 0) {
            const elapsedInterval = moment().diff(this.fields.interval_time);
            if (elapsedInterval >= this.fields.interval * 60 * 1000) await this.intervalNotification();
            else this.intervalClock = setTimeout(this.intervalNotification.bind(this), (this.fields.interval * 60 * 1000) - elapsedInterval);
        }
    }

    async update(newFields) {
        await this.addLogEntry('update');
        let ns = '';
        if (!newFields.enabled) {
            this.terminate();
            ns = 'good';
        }
        else if (this.fields.sigset !== newFields.sigset || this.fields.duration !== newFields.duration || this.fields.instant_revoke !== newFields.instant_revoke ||
            this.fields.delay !== newFields.delay || this.fields.condition !== newFields.condition) {
            clearTimeout(this.conditionClock);
            clearTimeout(this.repeatClock);
            ns = 'good';
        }
        else if (this.fields.repeat !== newFields.repeat) {
            clearTimeout(this.repeatClock);
            if (newFields.repeat !== 0 && (this.fields.state === 'bad' || this.fields.state === 'better')) this.repeatClock = setTimeout(this.repeatNotification.bind(this), this.fields.repeat * 60 * 1000);
        }

        let sit = false;
        if ((!this.fields.enabled && newFields.enabled) || (newFields.enabled && this.fields.interval !== newFields.interval)) {
            sit = true;
            clearTimeout(this.intervalClock);
            if (newFields.interval !== 0) this.intervalClock = setTimeout(this.intervalNotification.bind(this), newFields.interval * 60 * 1000);
        }

        this.fields = newFields;
        if (ns !== '') await this.writeState(ns);
        if (sit) await this.setIntervalTime();
    }

    terminate(){
        clearTimeout(this.conditionClock);
        clearTimeout(this.repeatClock);
        clearTimeout(this.intervalClock);
    }

    async execute(){
        if (!this.fields.enabled) return;

        clearTimeout(this.intervalClock);
        await this.setIntervalTime();
        if (this.fields.interval !== 0) this.intervalClock = setTimeout(this.intervalNotification.bind(this), this.fields.interval * 60 * 1000);

        const result = await evaluate(this.fields.condition, this.fields.sigset);
        if (typeof result === 'boolean') await this.changeState(result);
        else await this.addLogEntry(result);
    }

    /*
    * Possible states are: good, worse, bad, better.
    * Boolean result means wrong incoming data, !result means right incoming data
    */
    async changeState(result){
        if (result) {
            if (this.fields.state === 'good') {
                if (this.fields.duration === 0) {
                    await this.trigger();
                }
                else {
                    await this.writeState('worse');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), this.fields.duration * 60 * 1000);
                }
            }
            else if (this.fields.state === 'better') {
                clearTimeout(this.conditionClock);
                await this.writeState('bad');
            }
        }
        else {
            if (this.fields.state === 'bad') {
                if (this.fields.delay === 0) {
                    await this.revoke();
                }
                else {
                    await this.writeState('better');
                    this.conditionClock = setTimeout(this.conditionClockHandler.bind(this), this.fields.delay * 60 * 1000);
                }
            }
            else if (this.fields.state === 'worse') {
                clearTimeout(this.conditionClock);
                await this.writeState('good');
            }
        }
    }

    async conditionClockHandler(){
        if (this.fields.state === 'worse') {
            await this.trigger();
        }
        else if (this.fields.state === 'better') {
            await this.revoke();
        }
    }

    async trigger(){
        if (this.fields.instant_revoke) {
            await this.writeState('good');
            await this.addLogEntry('triggerAndRevoke');
            const subject = `Alert ${this.fields.name} was triggered and revoked!`;
            const text = `Alert ${this.fields.name} was triggered and revoked!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nCondition:\n${this.fields.condition}`;
            await this.sendNotification(subject, text, subject);
        }
        else {
            await this.writeState('bad');
            await this.addLogEntry('trigger');
            if (this.fields.repeat !== 0) this.repeatClock = setTimeout(this.repeatNotification.bind(this), this.fields.repeat * 60 * 1000);
            const subject = `Alert ${this.fields.name} was triggered!`;
            const text = `Alert ${this.fields.name} was triggered!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nCondition:\n${this.fields.condition}`;
            await this.sendNotification(subject, text, subject);
        }
    }

    async revoke(){
        clearTimeout(this.repeatClock);
        await this.writeState('good');
        await this.addLogEntry('revoke');
        if (this.fields.finalnotification) {
            const subject = `Alert ${this.fields.name} was revoked`;
            const text = `Alert ${this.fields.name} was revoked.\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nCondition:\n${this.fields.condition}`;
            await this.sendNotification(subject, text);
        }
    }

    async repeatNotification() {
        this.repeatClock = setTimeout(this.repeatNotification.bind(this), this.fields.repeat * 60 * 1000);
        const subject = `Alert ${this.fields.name} is still triggered!`;
        const text = `Alert ${this.fields.name} has been triggered!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nCondition:\n${this.fields.condition}`;
        await this.sendNotification(subject, text);
    }

    async writeState(newState) {
        const time = moment().format('YYYY-MM-DD HH:mm:ss');
        await knex.transaction(async tx => {
            await tx('alerts').where('id', this.fields.id).update({state: newState, state_changed: time});
            this.fields.state_changed = (await tx('alerts').where('id', this.fields.id).first('state_changed')).state_changed;
            this.fields.state = newState;
        });
    }

    async addLogEntry(value){
        try {
            await knex('alerts_log').insert({alert: this.fields.id, type: value});
        }
        catch (e) {}
    }

    async intervalNotification() {
        await this.setIntervalTime();
        this.intervalClock = setTimeout(this.intervalNotification.bind(this), this.fields.interval * 60 * 1000);
        await this.addLogEntry('interval');
        const subject = `Alert ${this.fields.name}: Signal record did not arrive in time!`;
        const text = `Alert ${this.fields.name}: Signal record did not arrive in time!\nTime: ${moment().format('YYYY-MM-DD HH:mm:ss')}\nDescription:\n${this.fields.description}\nInterval: ${this.fields.interval}`;
        await this.sendNotification(subject, text);
    }

    async setIntervalTime() {
        const time = moment().format('YYYY-MM-DD HH:mm:ss');
        await knex.transaction(async tx => {
            await tx('alerts').where('id', this.fields.id).update({interval_time: time});
            this.fields.interval_time = (await tx('alerts').where('id', this.fields.id).first('interval_time')).interval_time;
        });
    }

    async sendNotification(emailSubject, emailText, SMSText) {
        const senderName = 'IVIS Alert';
        const addresses = this.fields.emails.split(/\r?\n/).slice(0, config.alerts.maxEmailRecipients);
        await sendEmail(senderName, addresses, emailSubject, emailText);
        if (SMSText) {
            const phones = this.fields.phones.split(/\r?\n/).slice(0, config.alerts.maxSMSRecipients);
            for (let i = 0; i < phones.length; i++) await sendSMS(phones[i], senderName + '\n' + SMSText);
        }
    }
}

module.exports.Alert = Alert;
