// positionManager.js - Gerenciamento de posições e ordens
const axios = require('axios');
const crypto = require('crypto');
const log = require('./logger');

const baseUrl = 'https://fapi.binance.com';

/**
 * Monitora posições através do WebSocket
 * @param {string} conta - Nome da conta
 * @param {Object} credenciais - Credenciais da conta
 * @param {WebSocket} ws - Conexão WebSocket
 */
function monitorarPosicoes(conta, credenciais, ws) {
    // Evento: Mensagem recebida do WebSocket
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            
            // Verifica se é um evento de atualização de posição
            if (message.e === 'ACCOUNT_UPDATE') {
                await processarAtualizacaoConta(message, conta, credenciais);
            }
            
            // Verifica se é um evento de execução de ordem
            if (message.e === 'ORDER_TRADE_UPDATE') {
                await processarAtualizacaoOrdem(message, conta, credenciais);
            }
            
        } catch (error) {
            log('monitorar', `Erro ao processar mensagem WebSocket para ${conta}: ${error.message}`);
        }
    });
}

/**
 * Processa atualização de conta
 * @param {Object} message - Mensagem do WebSocket
 * @param {string} conta - Nome da conta
 * @param {Object} credenciais - Credenciais da conta
 */
async function processarAtualizacaoConta(message, conta, credenciais) {
    const positions = message.a.P; // Posições
    
    for (const position of positions) {
        const symbol = position.s;
        const positionAmt = parseFloat(position.pa);
        const unrealizedPnl = parseFloat(position.up);
        
        if (positionAmt !== 0) {
            log('monitorar', `${conta} - Posição atualizada: ${symbol} | Quantidade: ${positionAmt} | PnL: ${unrealizedPnl.toFixed(2)} USDT`);
            
            // Verifica se precisa fechar posição por stop loss ou take profit
            await verificarFechamentoPosicao(symbol, positionAmt, unrealizedPnl, conta, credenciais);
        }
    }
}

/**
 * Processa atualização de ordem
 * @param {Object} message - Mensagem do WebSocket
 * @param {string} conta - Nome da conta
 * @param {Object} credenciais - Credenciais da conta
 */
async function processarAtualizacaoOrdem(message, conta, credenciais) {
    const order = message.o;
    const symbol = order.s;
    const side = order.S;
    const status = order.X;
    const quantity = order.q;
    const price = order.p;
    
    log('monitorar', `${conta} - Ordem ${status}: ${side} ${quantity} ${symbol} @ ${price}`);
}

/**
 * Verifica se deve fechar posição baseado em critérios de risco
 * @param {string} symbol - Símbolo da posição
 * @param {number} positionAmt - Quantidade da posição
 * @param {number} unrealizedPnl - PnL não realizado
 * @param {string} conta - Nome da conta
 * @param {Object} credenciais - Credenciais da conta
 */
async function verificarFechamentoPosicao(symbol, positionAmt, unrealizedPnl, conta, credenciais) {
    const STOP_LOSS_PERCENT = -2.0; // Stop loss em -2%
    const TAKE_PROFIT_PERCENT = 3.0; // Take profit em +3%
    
    // Obtém informações da conta para calcular percentual
    const saldo = await obterSaldoConta(credenciais);
    if (!saldo) return;
    
    const pnlPercent = (unrealizedPnl / saldo) * 100;
    
    if (pnlPercent <= STOP_LOSS_PERCENT) {
        log('monitorar', `${conta} - STOP LOSS ativado para ${symbol}: ${pnlPercent.toFixed(2)}%`);
        await fecharPosicao(symbol, positionAmt, conta, credenciais, 'STOP_LOSS');
    } else if (pnlPercent >= TAKE_PROFIT_PERCENT) {
        log('monitorar', `${conta} - TAKE PROFIT ativado para ${symbol}: ${pnlPercent.toFixed(2)}%`);
        await fecharPosicao(symbol, positionAmt, conta, credenciais, 'TAKE_PROFIT');
    }
}

/**
 * Obtém saldo da conta
 * @param {Object} credenciais - Credenciais da conta
 * @returns {number|null} Saldo em USDT
 */
async function obterSaldoConta(credenciais) {
    const endpoint = '/fapi/v2/account';
    const url = `${baseUrl}${endpoint}`;
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac('sha256', credenciais.apiSecret)
        .update(queryString)
        .digest('hex');

    try {
        const response = await axios.get(url, {
            params: { timestamp, signature },
            headers: { 'X-MBX-APIKEY': credenciais.apiKey }
        });

        const saldoUSDT = response.data.assets.find(asset => asset.asset === 'USDT').walletBalance;
        return parseFloat(saldoUSDT);
    } catch (error) {
        log('monitorar', `Erro ao obter saldo da conta: ${error.message}`);
        return null;
    }
}

/**
 * Fecha posição
 * @param {string} symbol - Símbolo da posição
 * @param {number} positionAmt - Quantidade da posição
 * @param {string} conta - Nome da conta
 * @param {Object} credenciais - Credenciais da conta
 * @param {string} motivo - Motivo do fechamento
 */
async function fecharPosicao(symbol, positionAmt, conta, credenciais, motivo) {
    const endpoint = '/fapi/v1/order';
    const url = `${baseUrl}${endpoint}`;
    const side = positionAmt > 0 ? 'SELL' : 'BUY';
    const quantity = Math.abs(positionAmt);
    
    const params = {
        symbol: symbol,
        side: side,
        type: 'MARKET',
        quantity: quantity.toString(),
        timestamp: Date.now()
    };

    const queryString = Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

    const signature = crypto
        .createHmac('sha256', credenciais.apiSecret)
        .update(queryString)
        .digest('hex');

    params.signature = signature;

    try {
        const response = await axios.post(url, null, {
            params: params,
            headers: { 'X-MBX-APIKEY': credenciais.apiKey }
        });

        log('monitorar', `${conta} - Posição fechada (${motivo}): ${side} ${quantity} ${symbol}`);
        return response.data;
    } catch (error) {
        log('monitorar', `${conta} - Erro ao fechar posição ${symbol}: ${error.message}`);
        return null;
    }
}

module.exports = {
    monitorarPosicoes,
    verificarFechamentoPosicao,
    fecharPosicao
};
