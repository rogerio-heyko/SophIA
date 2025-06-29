const axios = require('axios');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Função para obter todas as contas definidas no arquivo .env
function obterContas() {
    const contas = [];
    for (const key in process.env) {
        if (key.startsWith('TRADER') && key.endsWith('_APIKEY')) {
            const nomeConta = key.replace('_APIKEY', ''); // Remove o sufixo _APIKEY
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
        console.error(`Credenciais da conta ${conta} não encontradas no arquivo .env.`);
        return null;
    }

    return { apiKey, apiSecret };
}

// Função para gerar a assinatura da Binance
async function getBinanceSignature(queryString, apiSecret) {
    return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

// Função para chamar a API da Binance
async function callBinanceAPI(method, endpoint, params = {}, apiKey, apiSecret) {
    try {
        const timestamp = Date.now();

        const queryString = Object.keys(params)
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');

        const signature = await getBinanceSignature(`${queryString}&timestamp=${timestamp}`, apiSecret);

        const url = `https://fapi.binance.com${endpoint}?${queryString}&timestamp=${timestamp}&signature=${signature}`;

        const response = await axios({
            method,
            url,
            headers: { 'X-MBX-APIKEY': apiKey },
        });

        return response.data;
    } catch (error) {
        console.error('Erro na chamada da API da Binance:', error.response ? error.response.data : error.message || error);
    }
}

// Função para alterar alavancagem e tipo de margem
async function alterarAlavancagemEMargem(apiKey, apiSecret) {
    try {
        const paresMoedas = [
            'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT', '1MBABYDOGEUSDT',
            'ADAUSDT', 'BNBUSDT', 'TRXUSDT', 'POLUSDT', 'LINKUSDT'
        ];

        for (const par of paresMoedas) {
            const novaAlavancagem = 50; // ajuste conforme necessário

            console.log(`Tentando atualizar alavancagem e tipo de margem para ${par}`);

            // Define a nova alavancagem para o par
            console.log(`Definindo nova alavancagem para ${par}: ${novaAlavancagem}x`);
            await callBinanceAPI('POST', '/fapi/v1/leverage', {
                symbol: par,
                leverage: novaAlavancagem,
                recvWindow: 10000, // ajuste conforme necessário
            }, apiKey, apiSecret);

            // Define o tipo de margem como "ISOLATED"
            console.log(`Definindo tipo de margem como "ISOLATED" para ${par}`);
            await callBinanceAPI('POST', '/fapi/v1/marginType', {
                symbol: par,
                marginType: 'ISOLATED',
                recvWindow: 10000, // ajuste conforme necessário
            }, apiKey, apiSecret);

            console.log(`Alavancagem e tipo de margem atualizados para ${par}: alavancagem ${novaAlavancagem}x, margem ISOLATED`);
        }
    } catch (error) {
        console.error('Erro ao alterar alavancagem e margem:', error.response ? error.response.data : error.message || error);
    }
}

// Função principal para aplicar as alterações em todas as contas
async function aplicarAlteracoesEmTodasAsContas() {
    const contas = obterContas();
    if (contas.length === 0) {
        console.error('Nenhuma conta encontrada no arquivo .env.');
        return;
    }

    for (const conta of contas) {
        const credenciais = obterCredenciaisConta(conta);
        if (!credenciais) continue;

        console.log(`Aplicando alterações na conta ${conta}...`);
        await alterarAlavancagemEMargem(credenciais.apiKey, credenciais.apiSecret);
        console.log(`Alterações concluídas para a conta ${conta}.`);
    }
}

// Chamada da função principal
aplicarAlteracoesEmTodasAsContas();