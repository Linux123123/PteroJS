const fetch = require('node-fetch');
const { RequestError, PteroAPIError } = require('../../structures/Errors');
const { version } = require('../../../package.json');

class ApplicationRequestManager {
    constructor(client) {
        this.client = client
        this.headers['Authorization'] = `Bearer ${client.auth}`;
    }

    suspended = false;
    headers = {
        'User-Agent': `Application PteroJS v${version}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    /** Sends a request to the Pterodactyl API. Returns a json object or `null` if
     * an unknown response code is received.
     * @param {string} path The path to request.
     * @param {object} [params] Optional payload data (POST, PUT and PATCH).
     * @param {string} [method] The method or HTTP verb to use.
     * @returns {Promise<object|void>}
     */
    async make(path, params, method = 'GET') {
        if (this.suspended) throw new RequestError('[429] Application is ratelimited.');
        const body = params?.raw ?? (params ? JSON.stringify(params) : null);
        const data = await fetch(this.client.domain + path, {
            method,
            body,
            headers: this.headers
        });

        if ([201, 204].includes(data.status)) return;
        if (data.status === 200) return await data.json();
        if ([400, 404].includes(data.status)) throw new PteroAPIError(await data.json());
        if (data.status === 401) throw new RequestError('[401] Unauthorized API request.');
        if (data.status === 403) throw new RequestError('[403] API Path forbidden.');
        if (data.status === 429) {
            this.suspended = true;
            setTimeout(() => this.suspended = false, 600000);
            throw new RequestError('[429] Application is ratelimited, retrying in 10 minutes.');
        }
        throw new RequestError(`Pterodactyl API returned an invalid or malformed payload (code: ${data.status}).`);
    }

    /**
     * Sends a ping request to the Pterodactyl API.
     * Because the API has no "ping" endpoint, we use a forced error to receive a 404 response
     * then check that it is a valid 404 error by the API and not a timeout response.
     * @returns {Promise<boolean>}
     */
    async ping() {
        try {
            await this.make('/api/application');
        } catch (err) {
            if (!err?.code) throw new RequestError('Pterodactyl API is unavailable.');
            return true;
        }
    }
}

module.exports = ApplicationRequestManager;
