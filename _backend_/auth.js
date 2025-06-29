// auth.js módulo auxiliar do monitorarPosicoes.js
const axios = require('axios');
const crypto = require('crypto');
const dotenv = require('dotenv');
const log = require('./logger');

dotenv.config();

const baseUrl = 'https://fapi.binance.com';

// Função para obter todas as contas definidas no arquivo .env
function obterContas() {
    const contas = [];
    for (const key in process.env) {
        if (key.startsWith('TRADER') && key.endsWith('_APIKEY')) {
            const nomeConta = key.replace('_APIKEY', '');
            contas.push(nomeConta);
        }
    }
    return contas;
}

// Função para obter as credenciais de uma conta
function obterCredenciaisConta(conta) {
    const apiKey = process.env[`${conta}_APIKEY`];
    const apiSecret = process.env[`${conta}_APISECRET`];

    if (!apiKey || !apiSecret) {
        log('monitorar', `Credenciais da conta ${conta} não encontradas no arquivo .env.`);
        return null;
    }

    return { apiKey, apiSecret };
}

// Função para assinar a requisição com a API Secret
function assinarRequisicao(params, apiSecret) {
    const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');
    return crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');
}

// Função para obter as posições abertas de uma conta
async function obterPosicoesAbertas(apiKey, apiSecret) {
    const endpoint = '/fapi/v2/positionRisk';
    const url = `${baseUrl}${endpoint}`;

    const params = {
        timestamp: Date.now(),
    };

    // Assina a requisição
    params.signature = assinarRequisicao(params, apiSecret);

    try {
        const response = await axios.get(url, {
            params: params,
            headers: {
                'X-MBX-APIKEY': apiKey,
            },
        });

        // Filtra apenas as posições abertas (quantidade diferente de zero)
        const posicoesAbertas = response.data.filter(posicao => parseFloat(posicao.positionAmt) !== 0);
        //log('monitorar', `Posições abertas obtidas: ${JSON.stringify(posicoesAbertas)}`);
        return posicoesAbertas;
    } catch (error) {
        log('monitorar', 'Erro ao obter posições abertas:', error.response ? error.response.data : error.message);
        return [];
    }
}

// Função para obter a listenKey de uma conta
async function obterListenKey(apiKey) {
    const endpoint = '/fapi/v1/listenKey';
    const url = `${baseUrl}${endpoint}`;

    try {
        const response = await axios.post(url, null, {
            headers: { 'X-MBX-APIKEY': apiKey }
        });
        //log('monitorar', `ListenKey obtida: ${response.data.listenKey}`);
        return response.data.listenKey;
    } catch (error) {
        log('monitorar', 'Erro ao obter listenKey:', error.message);
        return null;
    }
}

// Função para obter os últimos 14 preços de fechamento do gráfico de 5 minutos
async function obterUltimos14Fechamentos(symbol) {
    const endpoint = '/fapi/v1/klines';
    const url = `${baseUrl}${endpoint}`;

    try {
        const response = await axios.get(url, {
            params: {
                symbol: symbol,
                interval: '5m',
                limit: 14
            }
        });

        // Extrai os preços de fechamento (índice 4 no array de klines)
        const fechamentos = response.data.map(kline => parseFloat(kline[4]));
        //log('monitorar', `Últimos 14 fechamentos para ${symbol}: ${JSON.stringify(fechamentos)}`);
        return fechamentos;
    } catch (error) {
        log('monitorar', `Erro ao obter os últimos 14 fechamentos para ${symbol}:`, error.message);
        return null;
    }
}

module.exports = {
    obterContas,
    obterCredenciaisConta,
    obterListenKey,
    obterPosicoesAbertas,
    obterUltimos14Fechamentos
};