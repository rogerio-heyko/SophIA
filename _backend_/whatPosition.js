const axios = require('axios');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// URL base da API de Futuros da Binance
const baseUrl = 'https://fapi.binance.com';

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
        return posicoesAbertas;
    } catch (error) {
        console.error('Erro ao obter posições abertas:', error.response ? error.response.data : error.message);
        return [];
    }
}

// Função principal para levantar as posições abertas
async function levantarPosicoesAbertas() {
    const contas = obterContas();
    if (contas.length === 0) {
        console.error('Nenhuma conta encontrada no arquivo .env.');
        return;
    }

    // Itera sobre todas as contas
    for (const conta of contas) {
        const credenciais = obterCredenciaisConta(conta);
        if (!credenciais) continue;

        const { apiKey, apiSecret } = credenciais;

        // Obtém as posições abertas da conta
        const posicoesAbertas = await obterPosicoesAbertas(apiKey, apiSecret);

        if (posicoesAbertas.length === 0) {
            console.log(`Nenhuma posição aberta encontrada na conta ${conta}.`);
            continue;
        }

        console.log(`\nPosições abertas na conta ${conta}:`);
        posicoesAbertas.forEach(posicao => {
            const symbol = posicao.symbol;
            const pnlNaoRealizado = parseFloat(posicao.unRealizedProfit).toFixed(2);
            console.log(`- Symbol: ${symbol}, PNL Não Realizado: ${pnlNaoRealizado} USDT`);
        });
    }
}

// Inicia o levantamento das posições abertas
levantarPosicoesAbertas();