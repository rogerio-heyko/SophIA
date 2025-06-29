// tradeManager.js módulo auxiliar do monitorarPosicoes.js
const axios = require('axios');
const crypto = require('crypto');
const log = require('./logger');

async function fecharPosicao(symbol, side, quantity, apiKey, apiSecret) {
    const endpoint = '/fapi/v1/order';
    const url = `https://fapi.binance.com${endpoint}`;

    const params = {
        symbol: symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // Inverte o lado para fechar a posição
        type: 'MARKET',
        quantity: quantity,
        timestamp: Date.now(),
    };

    const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

    params.signature = signature;

    try {
        log('monitorar', `Parâmetros para fechar posição: ${JSON.stringify(params)}`);
        const response = await axios.post(url, null, {
            params: params,
            headers: {
                'X-MBX-APIKEY': apiKey,
            },
        });

        log('monitorar', 'Posição fechada com sucesso:', response.data);
        return response.data;
    } catch (error) {
        log('monitorar', 'Erro ao fechar a posição:', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { fecharPosicao };