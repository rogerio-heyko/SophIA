// Importa as bibliotecas necessárias
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const log = require('./logger');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Verifica se o processo já está rodando
if (global.analiseTecnicaIniciado) {
    console.log('analiseTecnica.js já está em execução. Ignorando nova instância.');
    process.exit(0);
}
global.analiseTecnicaIniciado = true;

// Caminho para a pasta compartilhada do N8N
const SHARED_PATH = '/data/shared';
const ANALISE_FILE = path.join(SHARED_PATH, 'analisarOrdem.json');

log('analise', 'Sistema de análise técnica iniciado');

// Configurações da API da Binance Futures
const apiKey = process.env.TRADER01_APIKEY; // API Key da conta Trader01
const apiSecret = process.env.TRADER01_APISECRET; // API Secret da conta Trader01
const baseUrl = 'https://fapi.binance.com'; // URL base da API de Futuros da Binance

// Lista de pares de moedas a serem analisados (carregados do arquivo .env)
const paresMoedas = process.env.PAIRS.split(',');

// Períodos gráficos e intervalos
const periodos = [
    { nome: '5m', intervalo: '5m' },
    { nome: '30m', intervalo: '30m' },
    { nome: '4h', intervalo: '4h' }
];

const periodos2 = [
    { nome: '5m', intervalo: '5m' } 
];

// Função para obter o preço atual do par de moedas
async function obterPrecoAtual(symbol) {
    const endpoint = '/fapi/v1/ticker/price';
    const url = `${baseUrl}${endpoint}`;
    const params = { symbol };

    try {
        const response = await axios.get(url, { params });
        return parseFloat(response.data.price);
    } catch (error) {
        console.error(`Erro ao obter preço atual para ${symbol}:`, error.message);
        return null;
    }
}

// Função para calcular a média móvel simples (SMA)
async function calcularSMA(candles, periodo = 30, precoAtual) {
    const fechamentos = candles.slice(-periodo).map(candle => parseFloat(candle[4])); // candle[4] = close
    fechamentos[periodo - 1] = precoAtual; // Substitui o último fechamento pelo preço atual
    const soma = fechamentos.reduce((acc, val) => acc + val, 0);
    return soma / periodo;
}

// Função para determinar a tendência com base na média móvel
async function determinarTendencia(candles, periodo, precoAtual) {
    const sma = await calcularSMA(candles, periodo, precoAtual);
    return precoAtual > sma ? 'ALTA' : 'BAIXA';
}

// Função para obter os dados históricos de um par de moedas
async function obterDadosHistoricos(symbol, intervalo, limit = 30) {
    const endpoint = '/fapi/v1/klines';
    const url = `${baseUrl}${endpoint}`;
    const params = {
        symbol: symbol,
        interval: intervalo,
        limit: limit
    };

    try {
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error(`Erro ao obter dados históricos para ${symbol} (${intervalo}):`, error.message);
        return null;
    }
}

// Função para analisar a tendência de um par de moedas
async function analisarTendencia(symbol) {
    const tendencias = {};

    for (const periodo of periodos) {
        const candles = await obterDadosHistoricos(symbol, periodo.intervalo);
        if (!candles) continue;

        const precoAtual = await obterPrecoAtual(symbol);
        if (!precoAtual) continue;

        const tendencia = await determinarTendencia(candles, 30, precoAtual);
        tendencias[periodo.nome] = tendencia;
        //log('analise', `${symbol} - Tendência no período ${periodo.nome}: ${tendencia}`);
    }

    // Verifica se as tendências são unânimes
    const tendenciasUnanimas = Object.values(tendencias).every(tendencia => tendencia === tendencias[periodos[0].nome]);

    if (tendenciasUnanimas) {
        log('analise', `${symbol} passou na fase 1 (Tendência): ${tendencias[periodos[0].nome]}`);
        return { aprovado: true, tendencia: tendencias[periodos[0].nome] };
    } else {
        log('analise', `${symbol} reprovado na fase 1 (Tendência): tendências divergentes`);
        return { aprovado: false };
    }
}

// Função para calcular o RSI
async function calcularRSI(candles, periodo = 14, precoAtual) {
    // Extrai os preços de fechamento dos candles
    const fechamentos = candles.slice(-periodo).map(candle => parseFloat(candle[4])); // candle[4] = close
    fechamentos[periodo - 1] = precoAtual; // Substitui o último fechamento pelo preço atual

    let ganhos = 0;
    let perdas = 0;

    for (let i = 1; i < fechamentos.length; i++) {
        const diferenca = fechamentos[i] - fechamentos[i - 1];
        if (diferenca > 0) ganhos += diferenca;
        else perdas -= diferenca;
    }

    const avgGanhos = ganhos / periodo;
    const avgPerdas = perdas / periodo;

    if (avgPerdas === 0) return 100;

    const rs = avgGanhos / avgPerdas;
    return 100 - (100 / (1 + rs));
}

// Função para analisar o risco
async function analisarRisco(symbol, tendencia) {
    const candles4h = await obterDadosHistoricos(symbol, '4h');
    if (!candles4h) return { aprovado: false };

    const precoAtual = await obterPrecoAtual(symbol);
    if (!precoAtual) return { aprovado: false };

    // Extrai os preços mais altos e mais baixos dos candles
    const precosMaisAltos = candles4h.map(candle => parseFloat(candle[2])); // candle[2] = high
    const precosMaisBaixos = candles4h.map(candle => parseFloat(candle[3])); // candle[3] = low

    const precoMaisAlto = Math.max(...precosMaisAltos);
    const precoMaisBaixo = Math.min(...precosMaisBaixos);

    let distancia01, distancia02;

    if (tendencia === 'ALTA') {
        distancia01 = (precoAtual - precoMaisBaixo) / precoAtual;
        distancia02 = (precoMaisAlto - precoAtual) / precoAtual;
    } else {
        distancia01 = (precoMaisAlto - precoAtual) / precoAtual;
        distancia02 = (precoAtual - precoMaisBaixo) / precoAtual;
    }

    // Valida se os valores são números válidos
    if (isNaN(distancia01) || isNaN(distancia02)) {
        log('analise', `${symbol} - Erro no cálculo das distâncias: valores inválidos`);
        return { aprovado: false };
    }

    //log('analise', `${symbol} - Distância 01: ${distancia01}, Distância 02: ${distancia02}`);

    if (distancia01 > 0.2) {
        log('analise', `${symbol} reprovado na fase 2 (Risco): distancia01 > 0.2`);
        return { aprovado: false };
    }

    if (distancia02 < distancia01) {
        log('analise', `${symbol} reprovado na fase 2 (Risco): distancia02 < distancia01`);
        return { aprovado: false };
    }

    log('analise', `${symbol} passou na fase 2 (Risco)`);
    return { aprovado: true };
}

// Função para analisar o indicador RSI
async function analisarPower(symbol, tendencia) {
    const rsis = {};

    for (const periodo of periodos2) {
        const candles = await obterDadosHistoricos(symbol, periodo.intervalo);
        if (!candles) continue;

        const precoAtual = await obterPrecoAtual(symbol);
        if (!precoAtual) continue;

        const rsi = await calcularRSI(candles, 14, precoAtual);
        if (isNaN(rsi)) {
            log('analise', `${symbol} - Erro no cálculo do RSI para o período ${periodo.nome}`);
            continue;
        }

        rsis[periodo.nome] = rsi;
        //log('analise', `${symbol} - RSI no período ${periodo.nome}: ${rsi}`);
    }

    const rsiUnanimo = Object.values(rsis).every(rsi => {
        if (tendencia === 'ALTA') return rsi <= 30;
        else return rsi >= 70;
    });

    if (rsiUnanimo) {
        log('analise', `${symbol} passou na fase 3 (Power): Excelente Oportunidade`);
        return { aprovado: true, rsis };
    } else {
        log('analise', `${symbol} reprovado na fase 3 (Power): Ainda não é o momento de operar`);
        return { aprovado: false };
    }
}

// Função para gerar o arquivo JSON com as informações da ordem
function gerarArquivoJSON(symbol, side) {
    const json = {
        side: side,
        symbol: symbol,
        type: 'MARKET'
    };

    try {
        // Verifica se a pasta shared existe, se não, cria
        if (!fs.existsSync(SHARED_PATH)) {
            fs.mkdirSync(SHARED_PATH, { recursive: true });
            log('analise', `Pasta ${SHARED_PATH} criada.`);
        }

        // Escreve o arquivo na pasta compartilhada do N8N
        fs.writeFileSync(ANALISE_FILE, JSON.stringify(json, null, 2));
        log('analise', `Arquivo JSON gerado para N8N: ${ANALISE_FILE} - ${side} ${symbol}`);
    } catch (error) {
        log('analise', `Erro ao gerar arquivo JSON: ${error.message}`);
    }
}

// Função principal para iniciar a análise
async function iniciarAnalise() {
    while (true) { // Loop infinito para análise contínua
        for (const par of paresMoedas) {
            log('analise', `Analisando ${par}...`);

            const resultadoTendencia = await analisarTendencia(par);
            if (!resultadoTendencia.aprovado) continue;

            const resultadoRisco = await analisarRisco(par, resultadoTendencia.tendencia);
            if (!resultadoRisco.aprovado) continue;

            const resultadoPower = await analisarPower(par, resultadoTendencia.tendencia);
            if (!resultadoPower.aprovado) continue;

            // Se passou em todas as fases, gera o arquivo JSON para a ordem
            const side = resultadoTendencia.tendencia === 'ALTA' ? 'BUY' : 'SELL';
            gerarArquivoJSON(par, side);

            // Pausa de 1 minuto após encontrar uma oportunidade
            log('analise', `Oportunidade encontrada em ${par}. Pausando a análise por 1 minuto...`);
            await new Promise(resolve => setTimeout(resolve, 60000)); // Aguarda 60 segundos antes de continuar
        }

        await new Promise(resolve => setTimeout(resolve, 60000)); // Aguarda 60 segundos antes de reiniciar a análise
    }
}

// Tratamento de encerramento
process.on('SIGINT', () => {
    log('analise', 'Sistema de análise técnica sendo encerrado...');
    process.exit(0);
});

// Log de heartbeat a cada 5 minutos
setInterval(() => {
    log('analise', 'Sistema de análise técnica ativo - Analisando mercado...');
}, 5 * 60 * 1000);

// Inicia a análise
log('analise', 'Iniciando análise técnica dos pares de moedas...');
iniciarAnalise();