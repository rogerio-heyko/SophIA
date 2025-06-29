const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');
const xlsx = require('xlsx');
const path = require('path');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Configurações da API da Binance Futures
const baseUrl = 'https://fapi.binance.com'; // URL base da API de Futuros da Binance

// Função para obter as credenciais de uma conta
function obterCredenciaisConta(conta) {
    const apiKey = process.env[`${conta}_APIKEY`];
    const apiSecret = process.env[`${conta}_APISECRET`];

    if (!apiKey || !apiSecret) {
        console.error(`Credenciais da conta ${conta} não encontradas no arquivo .env.`);
        return null;
    }

    return { apiKey, apiSecret };
}

// Função para obter o saldo em USDT de uma conta
async function obterSaldoUSDT(apiKey, apiSecret) {
    const endpoint = '/fapi/v2/account';
    const url = `${baseUrl}${endpoint}`;
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');

    try {
        const response = await axios.get(url, {
            params: { timestamp, signature },
            headers: { 'X-MBX-APIKEY': apiKey }
        });

        const saldoUSDT = response.data.assets.find(asset => asset.asset === 'USDT').walletBalance;
        return parseFloat(saldoUSDT);
    } catch (error) {
        console.error('Erro ao obter saldo da conta:', error.response ? error.response.data : error.message);
        return 0;
    }
}

// Função para obter o histórico de trades de uma conta em intervalos de 7 dias
async function obterHistoricoTrades(symbol, apiKey, apiSecret, startTime, endTime) {
    const endpoint = '/fapi/v1/userTrades';
    const url = `${baseUrl}${endpoint}`;
    const timestamp = Date.now();
    const trades = [];

    // Divide o período em intervalos de 7 dias
    let currentStartTime = startTime;
    while (currentStartTime < endTime) {
        const currentEndTime = Math.min(currentStartTime + 7 * 24 * 60 * 60 * 1000, endTime);

        const queryString = `symbol=${symbol}&startTime=${currentStartTime}&endTime=${currentEndTime}&timestamp=${timestamp}`;
        const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(queryString)
            .digest('hex');

        try {
            const response = await axios.get(url, {
                params: { symbol, startTime: currentStartTime, endTime: currentEndTime, timestamp, signature },
                headers: { 'X-MBX-APIKEY': apiKey }
            });

            trades.push(...response.data);
        } catch (error) {
            console.error('Erro ao obter histórico de trades:', error.response ? error.response.data : error.message);
            return [];
        }

        currentStartTime = currentEndTime;
    }

    return trades;
}

// Função para calcular o PnL de cada trade e retornar apenas symbol e realizedPnl
function calcularPnL(trades) {
    return trades.map(trade => ({
        symbol: trade.symbol,
        realizedPnl: parseFloat(trade.realizedPnl)
    }));
}

// Função para obter o primeiro e o último dia do mês anterior
function obterPeriodoMesAnterior() {
    const agora = new Date();
    const primeiroDiaMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const ultimoDiaMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0);

    return {
        startTime: primeiroDiaMesAnterior.getTime(),
        endTime: ultimoDiaMesAnterior.getTime() + 24 * 60 * 60 * 1000 - 1 // Ajusta para o final do dia
    };
}

// Função para gerar o relatório
async function gerarRelatorio() {
    console.log('Iniciando geração do relatório...');

    // Extrai as contas do arquivo .env
    const contas = Object.keys(process.env)
        .filter(key => key.endsWith('_APIKEY'))
        .map(key => key.replace('_APIKEY', ''));

    if (contas.length === 0) {
        console.error('Nenhuma conta encontrada no arquivo .env.');
        return;
    }

    console.log(`Contas encontradas: ${contas.join(', ')}`);

    // Extrai os pares de moedas do arquivo .env
    const pares = process.env.PAIRS ? process.env.PAIRS.split(',') : [];

    if (pares.length === 0) {
        console.error('Nenhum par de moedas encontrado no arquivo .env.');
        return;
    }

    console.log(`Pares de moedas encontrados: ${pares.join(', ')}`);

    // Define os períodos de tempo
    const agora = Date.now();
    const umDiaAtras = agora - 24 * 60 * 60 * 1000;
    const seteDiasAtras = agora - 7 * 24 * 60 * 60 * 1000;
    const trintaDiasAtras = agora - 30 * 24 * 60 * 60 * 1000;

    // Obtém o período do mês anterior
    const { startTime: inicioMesAnterior, endTime: fimMesAnterior } = obterPeriodoMesAnterior();

    // Cria um novo workbook
    const workbook = xlsx.utils.book_new();

    for (const conta of contas) {
        console.log(`Processando conta: ${conta}`);

        const credenciais = obterCredenciaisConta(conta);
        if (!credenciais) continue;

        // Obtém o saldo inicial e final
        const saldoInicial = await obterSaldoUSDT(credenciais.apiKey, credenciais.apiSecret);
        const saldoFinal = await obterSaldoUSDT(credenciais.apiKey, credenciais.apiSecret);

        console.log(`Saldo inicial da conta ${conta}: ${saldoInicial}`);
        console.log(`Saldo final da conta ${conta}: ${saldoFinal}`);

        // Cria uma planilha para a conta
        const worksheetData = [
            [`Conta: ${conta}`], // Cabeçalho com o nome da conta
            ['Par', 'Período', 'Saldo Inicial', 'Saldo Final', 'Resultado', 'PNL Total', 'Histórico de Trades']
        ];

        for (const par of pares) {
            console.log(`Processando par de moedas: ${par}`);

            // Obtém o histórico de trades para os períodos
            const tradesDiario = await obterHistoricoTrades(par, credenciais.apiKey, credenciais.apiSecret, umDiaAtras, agora);
            const tradesSemanal = await obterHistoricoTrades(par, credenciais.apiKey, credenciais.apiSecret, seteDiasAtras, agora);
            const tradesMensal = await obterHistoricoTrades(par, credenciais.apiKey, credenciais.apiSecret, trintaDiasAtras, agora);
            const tradesMesAnterior = await obterHistoricoTrades(par, credenciais.apiKey, credenciais.apiSecret, inicioMesAnterior, fimMesAnterior);

            // Calcula o PnL para cada período
            const pnlDiario = calcularPnL(tradesDiario);
            const pnlSemanal = calcularPnL(tradesSemanal);
            const pnlMensal = calcularPnL(tradesMensal);
            const pnlMesAnterior = calcularPnL(tradesMesAnterior);

            // Adiciona os dados ao worksheet
            worksheetData.push([par, 'Diário', saldoInicial, saldoFinal, saldoFinal - saldoInicial, pnlDiario.reduce((acc, trade) => acc + trade.realizedPnl, 0), JSON.stringify(pnlDiario)]);
            worksheetData.push([par, 'Semanal', saldoInicial, saldoFinal, saldoFinal - saldoInicial, pnlSemanal.reduce((acc, trade) => acc + trade.realizedPnl, 0), JSON.stringify(pnlSemanal)]);
            worksheetData.push([par, 'Mensal (Últimos 30 dias)', saldoInicial, saldoFinal, saldoFinal - saldoInicial, pnlMensal.reduce((acc, trade) => acc + trade.realizedPnl, 0), JSON.stringify(pnlMensal)]);
            worksheetData.push([par, 'Mês Anterior', saldoInicial, saldoFinal, saldoFinal - saldoInicial, pnlMesAnterior.reduce((acc, trade) => acc + trade.realizedPnl, 0), JSON.stringify(pnlMesAnterior)]);
        }

        // Adiciona uma linha em branco entre as contas
        worksheetData.push([]);

        const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
        xlsx.utils.book_append_sheet(workbook, worksheet, conta);
    }

    // Salva o workbook em um arquivo .xls
    const caminhoRelatorio = path.join(__dirname, 'relatorio.xls');
    xlsx.writeFile(workbook, caminhoRelatorio);
    console.log(`Relatório gerado com sucesso: ${caminhoRelatorio}`);
}

// Executa a função para gerar o relatório
gerarRelatorio().catch(error => {
    console.error('Erro ao gerar relatório:', error);
});