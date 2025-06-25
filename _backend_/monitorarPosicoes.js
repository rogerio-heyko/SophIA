// monitorarPosicoes.js
const WebSocket = require('ws');
const axios = require('axios');
const { obterContas, obterCredenciaisConta, obterListenKey } = require('./auth');
const { monitorarPosicoes } = require('./positionManager');
const log = require('./logger');

// Verifica se o script já está em execução
if (global.monitorarPosicoesIniciado) {
    console.log('monitorarPosicoes.js já está em execução. Ignorando nova instância.');
    process.exit(0); // Encerra a execução duplicada
}
global.monitorarPosicoesIniciado = true; // Marca como iniciado

// Objeto para armazenar as conexões WebSocket ativas
const conexoesAtivas = {};

// Função para renovar a listenKey periodicamente
async function renovarListenKey(apiKey, conta) {
    const endpoint = '/fapi/v1/listenKey';
    const url = `https://fapi.binance.com${endpoint}`;

    try {
        await axios.put(url, null, {
            headers: { 'X-MBX-APIKEY': apiKey }
        });
        log('monitorar', `ListenKey renovada: ${conta}`);
    } catch (error) {
        log('monitorar', 'Erro ao renovar listenKey:', error.message);
    }
}

// Função para conectar ao WebSocket e iniciar o monitoramento
async function conectarWebSocket(conta, credenciais) {
    // Verifica se já existe uma conexão ativa para esta conta
    if (conexoesAtivas[conta]) {
        log('monitorar', `Já existe uma conexão ativa para a conta ${conta}. Ignorando nova conexão.`);
        return;
    }

    const listenKey = await obterListenKey(credenciais.apiKey);
    if (!listenKey) {
        log('monitorar', `Não foi possível obter a listenKey para a conta ${conta}.`);
        return;
    }

    const wsUrl = `wss://fstream.binance.com/ws/${listenKey}`;
    const ws = new WebSocket(wsUrl);

    // Armazena a conexão no objeto de conexões ativas
    conexoesAtivas[conta] = ws;

    // Evento: WebSocket conectado
    ws.on('open', () => {
        log('monitorar', `WebSocket conectado para a conta ${conta}`);
    });

    // Evento: Erro no WebSocket
    ws.on('error', (error) => {
        log('monitorar', `Erro no WebSocket para a conta ${conta}:`, error.message);
    });

    // Evento: WebSocket fechado (reconectar após 5 segundos)
    ws.on('close', () => {
        log('monitorar', `WebSocket fechado para a conta ${conta}. Tentando reconectar em 5 segundos...`);
        delete conexoesAtivas[conta]; // Remove a conexão do objeto de conexões ativas
        setTimeout(() => conectarWebSocket(conta, credenciais), 5000); // Reconecta após 5 segundos
    });

    // Inicia o monitoramento das posições
    monitorarPosicoes(conta, credenciais, ws);

    // Renova a listenKey a cada 30 minutos (1800000 ms)
    const intervaloRenovacao = setInterval(async () => {
        await renovarListenKey(credenciais.apiKey, listenKey);
    }, 30 * 60 * 1000); // 30 minutos

    // Limpa o intervalo quando o WebSocket é fechado
    ws.on('close', () => {
        clearInterval(intervaloRenovacao);
    });
}

// Função principal para monitorar as posições
async function iniciarMonitoramento() {
    const contas = obterContas();
    if (contas.length === 0) {
        log('monitorar', 'Nenhuma conta encontrada no arquivo .env.');
        return;
    }

    // Itera sobre todas as contas
    for (const conta of contas) {
        const credenciais = obterCredenciaisConta(conta);
        if (!credenciais) {
            log('monitorar', `Credenciais não encontradas para a conta ${conta}.`);
            continue;
        }

        // Conecta ao WebSocket e inicia o monitoramento
        conectarWebSocket(conta, credenciais);
    }
}

// Inicia o monitoramento
iniciarMonitoramento();