// auth.js - Gerenciamento de autenticação e credenciais
const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const baseUrl = 'https://fapi.binance.com';

/**
 * Obtém a lista de contas configuradas no .env
 * @returns {Array} Lista de contas
 */
function obterContas() {
    const contas = [];
    const envKeys = Object.keys(process.env);
    
    // Procura por padrões de API_KEY no .env
    envKeys.forEach(key => {
        if (key.endsWith('_APIKEY')) {
            const conta = key.replace('_APIKEY', '');
            contas.push(conta);
        }
    });
    
    return contas;
}

/**
 * Obtém as credenciais de uma conta específica
 * @param {string} conta - Nome da conta
 * @returns {Object|null} Credenciais da conta
 */
function obterCredenciaisConta(conta) {
    const apiKey = process.env[`${conta}_APIKEY`];
    const apiSecret = process.env[`${conta}_APISECRET`];

    if (!apiKey || !apiSecret) {
        console.error(`Credenciais da conta ${conta} não encontradas no arquivo .env.`);
        return null;
    }

    return { apiKey, apiSecret };
}

/**
 * Obtém a listenKey para WebSocket da Binance
 * @param {string} apiKey - Chave da API
 * @returns {string|null} ListenKey ou null em caso de erro
 */
async function obterListenKey(apiKey) {
    const endpoint = '/fapi/v1/listenKey';
    const url = `${baseUrl}${endpoint}`;

    try {
        const response = await axios.post(url, null, {
            headers: { 'X-MBX-APIKEY': apiKey }
        });
        return response.data.listenKey;
    } catch (error) {
        console.error('Erro ao obter listenKey:', error.message);
        return null;
    }
}

/**
 * Cria assinatura para requisições autenticadas da Binance
 * @param {string} queryString - String de consulta
 * @param {string} apiSecret - Chave secreta da API
 * @returns {string} Assinatura HMAC
 */
function criarAssinatura(queryString, apiSecret) {
    return crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');
}

module.exports = {
    obterContas,
    obterCredenciaisConta,
    obterListenKey,
    criarAssinatura
};
