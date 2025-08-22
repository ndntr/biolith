import Imap from 'imap';
import { log } from './utils.js';
/**
 * Fetch unread emails from Gmail using IMAP
 */
export class EmailFetcher {
    constructor(email, password) {
        this.config = {
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: {
                rejectUnauthorized: false,
                servername: 'imap.gmail.com'
            },
            user: email,
            password: password
        };
    }
    /**
     * Fetch the most recent unread email from EvidenceAlerts
     */
    async fetchLatestEvidenceEmail() {
        return new Promise((resolve, reject) => {
            const imap = new Imap(this.config);
            imap.once('ready', () => {
                log('IMAP connection established');
                imap.openBox('INBOX', false, (err, box) => {
                    if (err) {
                        reject(new Error(`Failed to open inbox: ${err.message}`));
                        return;
                    }
                    log('Searching for unread emails from EvidenceAlerts');
                    // Search for unread emails from EvidenceAlerts
                    imap.search([
                        'UNSEEN',
                        ['FROM', 'evidencealerts@mcmasterhkr.com']
                    ], (err, results) => {
                        if (err) {
                            reject(new Error(`Email search failed: ${err.message}`));
                            return;
                        }
                        if (!results || results.length === 0) {
                            log('No unread emails from EvidenceAlerts found');
                            imap.end();
                            resolve(null);
                            return;
                        }
                        log(`Found ${results.length} unread email(s) from EvidenceAlerts`);
                        // Get the most recent email (last in results array)
                        const latestEmailId = results[results.length - 1];
                        const fetch = imap.fetch(latestEmailId, {
                            bodies: '', // Fetch entire email
                            markSeen: true // Mark as read after fetching
                        });
                        let emailBuffer;
                        fetch.on('message', (msg, seqno) => {
                            log(`Fetching email ${seqno}`);
                            msg.on('body', (stream, info) => {
                                const chunks = [];
                                stream.on('data', (chunk) => {
                                    chunks.push(chunk);
                                });
                                stream.on('end', () => {
                                    emailBuffer = Buffer.concat(chunks);
                                    log(`Email ${seqno} fetched successfully (${emailBuffer.length} bytes)`);
                                });
                            });
                            msg.once('attributes', (attrs) => {
                                log(`Email attributes: UID=${attrs.uid}, Date=${attrs.date}`);
                            });
                        });
                        fetch.once('error', (err) => {
                            reject(new Error(`Fetch error: ${err.message}`));
                        });
                        fetch.once('end', () => {
                            log('Email fetch completed');
                            imap.end();
                            resolve(emailBuffer);
                        });
                    });
                });
            });
            imap.once('error', (err) => {
                log(`IMAP error: ${err.message}`, 'error');
                reject(new Error(`IMAP connection failed: ${err.message}`));
            });
            imap.once('end', () => {
                log('IMAP connection ended');
            });
            imap.connect();
        });
    }
    /**
     * Check connection to Gmail IMAP
     */
    async testConnection() {
        return new Promise((resolve) => {
            const imap = new Imap(this.config);
            imap.once('ready', () => {
                log('IMAP connection test successful');
                imap.end();
                resolve(true);
            });
            imap.once('error', (err) => {
                log(`IMAP connection test failed: ${err.message}`, 'error');
                resolve(false);
            });
            imap.connect();
        });
    }
    /**
     * Get count of unread emails from EvidenceAlerts
     */
    async getUnreadEmailCount() {
        return new Promise((resolve, reject) => {
            const imap = new Imap(this.config);
            imap.once('ready', () => {
                imap.openBox('INBOX', true, (err, box) => {
                    if (err) {
                        reject(new Error(`Failed to open inbox: ${err.message}`));
                        return;
                    }
                    imap.search([
                        'UNSEEN',
                        ['FROM', 'evidencealerts@mcmasterhkr.com']
                    ], (err, results) => {
                        if (err) {
                            reject(new Error(`Email search failed: ${err.message}`));
                            return;
                        }
                        const count = results ? results.length : 0;
                        log(`Found ${count} unread email(s) from EvidenceAlerts`);
                        imap.end();
                        resolve(count);
                    });
                });
            });
            imap.once('error', (err) => {
                reject(new Error(`IMAP connection failed: ${err.message}`));
            });
            imap.connect();
        });
    }
}
